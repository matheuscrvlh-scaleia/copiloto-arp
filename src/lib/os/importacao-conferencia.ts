import { calcularOS, type EntradaOS, type ResultadoOS } from "./calculos";
import {
  mapearStatusOS,
  mapearStatusTarefa,
  mapearStatusVistoria,
  type StatusImportado,
} from "./importacao";
import type {
  ArquivoDoPacote,
  OsInterna,
  OsTerceirizada,
  PacoteImportacao,
  TecnicoLegado,
  TipoDeRegistro,
} from "./importacao-modelo";
import { TIPOS_DE_REGISTRO } from "./importacao-modelo";
import {
  type Periodo,
  type RegraRateio,
  type RespostaAmbiente,
  STATUS,
  STATUS_VISTORIA,
  type StatusChamado,
  type StatusVistoria,
  type TipoVistoria,
} from "./rotulos";

// Prévia e conferências da importação (spec 4.14): quantos registros de cada
// tipo, se os totais batem com o sistema atual, como cada status antigo vai
// ficar (o que não está na tabela bloqueia até alguém escolher), custo e
// minuto-homem recalculados e comparados com o valor antigo, fotos citadas
// sem arquivo, técnicos sem valor por minuto e números de OS que já existem
// no módulo. Pura: a mesma função monta a prévia e decide a gravação.

export const ORIGEM_LEGADO = {
  os_internas: "osarp:os",
  os_terceirizadas: "osarp:os_terceirizada",
  tarefas: "osarp:tarefa",
} as const;

// ---------------------------------------------------------------------------
// Correspondências
// ---------------------------------------------------------------------------

export type TipoDeStatus = "os" | "tarefa" | "vistoria";

/** Status que a pessoa pode escolher para um status antigo fora da tabela. */
export const ESCOLHAS_CHAMADO: StatusChamado[] = [
  "aberto",
  "em_andamento",
  "aguardando",
  "fechado",
  "cancelado",
];
export const ESCOLHAS_VISTORIA: StatusVistoria[] = [
  "andamento",
  "finalizado",
  "cancelado",
];

/** Chave da escolha guardada em os.importacoes.mapeamento. */
export const chaveDoStatus = (tipo: TipoDeStatus, texto: string) =>
  `${tipo}:${texto.trim()}`;

/** Status novo de um registro antigo: a tabela, a escolha ou null. */
export function statusDoRegistro(
  tipo: "os" | "tarefa",
  texto: string,
  mapeamento: Record<string, string>,
): StatusImportado | null {
  const daTabela =
    tipo === "os" ? mapearStatusOS(texto) : mapearStatusTarefa(texto);
  if (daTabela) return daTabela;
  const escolhido = mapeamento[chaveDoStatus(tipo, texto)];
  if (!escolhido || !(ESCOLHAS_CHAMADO as string[]).includes(escolhido))
    return null;
  const status = escolhido as StatusChamado;
  return status === "aguardando"
    ? { status, aguardando_tipo: "outro" }
    : { status };
}

export function statusDaVistoria(
  texto: string,
  mapeamento: Record<string, string>,
): StatusVistoria | null {
  const daTabela = mapearStatusVistoria(texto);
  if (daTabela) return daTabela.status;
  const escolhido = mapeamento[chaveDoStatus("vistoria", texto)];
  return escolhido && (ESCOLHAS_VISTORIA as string[]).includes(escolhido)
    ? (escolhido as StatusVistoria)
    : null;
}

const chave = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Regra do rateio do sistema antigo → regra nova; null se não reconhecer. */
export function regraDeRateio(texto: string): RegraRateio | null {
  const t = chave(texto);
  if (/hora|colaborador|^sim$/.test(t)) return "hora_trabalhada";
  if (/manual|divis/.test(t)) return "manual";
  if (/porcent|percent/.test(t)) return "percentual";
  if (/terceir/.test(t)) return "terceirizado";
  return null;
}

export function periodoDaVisita(texto: string | undefined): Periodo | null {
  const t = chave(texto ?? "");
  if (t.startsWith("manh")) return "manha";
  if (t.startsWith("tard")) return "tarde";
  if (t.startsWith("noit")) return "noite";
  return null;
}

/** Tipo de vistoria; o que não reconhecer vira extraordinária (avisa). */
export function tipoDaVistoria(texto: string): TipoVistoria | null {
  const t = chave(texto);
  if (t.includes("entrada")) return "entrada";
  if (t.includes("saida")) return "saida";
  if (t.includes("prevent")) return "preventiva";
  if (t.includes("extra")) return "extraordinaria";
  return null;
}

export function respostaDoAmbiente(
  texto: string | undefined,
): RespostaAmbiente {
  const t = chave(texto ?? "");
  if (t.includes("nao se aplica") || t === "na" || t === "n a")
    return "nao_se_aplica";
  if (t.includes("pendente")) return "pendente";
  return "respondido";
}

export function campoDoTipo(
  texto: string | undefined,
): "sim" | "nao" | "nao_se_aplica" | null {
  const t = chave(texto ?? "");
  if (!t) return null;
  if (t.includes("se aplica")) return "nao_se_aplica";
  if (t.startsWith("s")) return "sim";
  if (t.startsWith("n")) return "nao";
  return null;
}

/** Nome do sistema antigo → usuário com o mesmo nome (sem acento e caixa). */
export function usuarioPeloNome(
  nome: string | undefined,
  usuarios: { id: string; nome: string }[],
): string | null {
  if (!nome) return null;
  const alvo = chave(nome);
  const iguais = usuarios.filter((u) => chave(u.nome) === alvo);
  return iguais.length === 1 ? (iguais[0]?.id ?? null) : null;
}

// ---------------------------------------------------------------------------
// Custo da OS (o mesmo cálculo das OS novas, no modo do sistema antigo)
// ---------------------------------------------------------------------------

/** Antes de qualquer sessão: o sistema antigo não guarda vigência. */
export const VIGENCIA_IMPORTADA = "1900-01-01";

export function entradaDoCalculo(
  os: OsInterna | OsTerceirizada,
  tecnicos: TecnicoLegado[],
): EntradaOS {
  const sessoes =
    "sessoes" in os
      ? os.sessoes.map((s) => ({
          data: s.data,
          inicio: s.inicio,
          fim: s.fim ?? null,
          almoco_inicio:
            s.almoco_inicio && s.almoco_fim ? s.almoco_inicio : null,
          almoco_fim: s.almoco_inicio && s.almoco_fim ? s.almoco_fim : null,
          tecnicos: s.tecnicos,
        }))
      : [];
  const regra = os.rateio ? regraDeRateio(os.rateio.regra) : null;
  return {
    sessoes,
    vigencias: tecnicos.flatMap((t) =>
      t.valor_minuto == null
        ? []
        : [
            {
              tecnico_id: t.id,
              vigente_desde: VIGENCIA_IMPORTADA,
              valor_minuto: t.valor_minuto,
            },
          ],
    ),
    materiais:
      "materiais" in os
        ? os.materiais.map((m) => ({
            descricao: m.descricao,
            quantidade: m.quantidade,
            valor_unitario: m.valor_unitario ?? null,
          }))
        : [],
    terceirizado: "valor" in os ? (os.valor ?? null) : null,
    rateio: !regra
      ? null
      : regra === "manual"
        ? { regra, valor: os.rateio?.valor ?? null }
        : regra === "percentual"
          ? { regra, percentual: os.rateio?.valor ?? null }
          : { regra },
    legado: true,
    nomes: Object.fromEntries(tecnicos.map((t) => [t.id, t.nome])),
  };
}

export interface DiferencaDeCusto {
  numero: number;
  tipo: "os_internas" | "os_terceirizadas";
  campos: { campo: string; antigo: number; novo: number }[];
}

/** Compara o recalculado com o antigo: centavo a centavo e minuto a minuto. */
export function compararCusto(
  numero: number,
  tipo: DiferencaDeCusto["tipo"],
  legado: OsInterna["legado"],
  r: ResultadoOS,
): DiferencaDeCusto | null {
  const campos: DiferencaDeCusto["campos"] = [];
  const conferir = (
    campo: string,
    antigo: number | null | undefined,
    novo: number,
    tolerancia: number,
  ) => {
    if (antigo == null) return;
    if (Math.abs(antigo - novo) > tolerancia)
      campos.push({ campo, antigo, novo });
  };
  conferir("Custo total", legado?.valor_total, r.total, 0.005);
  conferir("Valor do rateio", legado?.valor_rateio, r.valorRateio, 0.005);
  conferir("Minutos", legado?.minutos, r.minutos, 0);
  conferir("Minuto-homem", legado?.minuto_homem, r.minutoHomem, 0);
  return campos.length ? { numero, tipo, campos } : null;
}

// ---------------------------------------------------------------------------
// Prévia
// ---------------------------------------------------------------------------

export interface ContextoDaConferencia {
  /** Chamados do módulo com os números do pacote. */
  numerosNoModulo: Map<
    number,
    { legado_origem: string | null; legado_id: string | null }
  >;
  /** Vistorias do módulo com os códigos do pacote. */
  codigosNoModulo: Map<string, { legado_id: string | null }>;
  usuarios: { id: string; nome: string }[];
  mapeamento: Record<string, string>;
  acharArquivo: (citado: string) => ArquivoDoPacote | null;
}

export interface LinhaDaContagem {
  tipo: TipoDeRegistro;
  rotulo: string;
  lidos: number;
  recusados: number;
  sistemaAtual: number | null;
  bate: boolean;
}

export interface CorrespondenciaDeStatus {
  tipo: TipoDeStatus;
  antigo: string;
  /** Rótulo do status novo; null = falta escolher. */
  novo: string | null;
  quantidade: number;
  /** true: veio da tabela; false: escolhido na prévia. */
  daTabela: boolean;
}

export interface Problema {
  texto: string;
  bloqueia: boolean;
}

export type DecisaoDoNumero = "manter" | "atualizar" | "numero_novo";

export interface Previa {
  sistema: string | null;
  geradoEm: string | null;
  contagens: LinhaDaContagem[];
  status: CorrespondenciaDeStatus[];
  custosConferidos: number;
  diferencasDeCusto: DiferencaDeCusto[];
  fotos: number;
  fotosFaltando: { onde: string; arquivo: string }[];
  tecnicosSemValor: string[];
  tecnicosLigados: { nome: string; usuarioId: string }[];
  /** OS que já existem no módulo (atualiza) ou cujo número já é usado. */
  numeros: { numero: number; tipo: string; decisao: DecisaoDoNumero }[];
  problemas: Problema[];
  recusadas: PacoteImportacao["recusadas"];
  podeConfirmar: boolean;
}

/**
 * O que fazer com o número de cada OS: manter o número antigo, atualizar o
 * registro importado antes (mesma origem e id) ou, se o número já é de um
 * chamado do módulo, entrar com número novo (o antigo fica guardado).
 */
export function decidirNumeros(
  pacote: PacoteImportacao,
  numerosNoModulo: ContextoDaConferencia["numerosNoModulo"],
): Map<string, DecisaoDoNumero> {
  const decisoes = new Map<string, DecisaoDoNumero>();
  const usados = new Set<number>();
  const tipos = ["os_internas", "os_terceirizadas"] as const;
  for (const tipo of tipos)
    for (const os of pacote.registros[tipo]) {
      const chaveOs = `${tipo}:${os.numero}`;
      const noModulo = numerosNoModulo.get(os.numero);
      let decisao: DecisaoDoNumero = "manter";
      if (
        noModulo &&
        noModulo.legado_origem === ORIGEM_LEGADO[tipo] &&
        noModulo.legado_id === String(os.numero)
      )
        decisao = "atualizar";
      else if (noModulo || usados.has(os.numero)) decisao = "numero_novo";
      usados.add(os.numero);
      decisoes.set(chaveOs, decisao);
    }
  return decisoes;
}

export function conferir(
  pacote: PacoteImportacao,
  ctx: ContextoDaConferencia,
): Previa {
  const r = pacote.registros;
  const problemas: Problema[] = [];

  // Totais dos dois lados.
  const contagens: LinhaDaContagem[] = (
    Object.keys(TIPOS_DE_REGISTRO) as TipoDeRegistro[]
  ).flatMap((tipo) => {
    const lidos = r[tipo].length;
    const recusados = pacote.recusadas.filter((x) => x.tipo === tipo).length;
    const sistemaAtual = pacote.manifesto.totais[tipo] ?? null;
    if (!lidos && !recusados && !sistemaAtual) return [];
    return [
      {
        tipo,
        rotulo: TIPOS_DE_REGISTRO[tipo],
        lidos,
        recusados,
        sistemaAtual,
        bate: sistemaAtual !== null && sistemaAtual === lidos,
      },
    ];
  });
  for (const c of contagens.filter((x) => !x.bate))
    problemas.push({
      bloqueia: true,
      texto:
        c.sistemaAtual === null
          ? `${c.rotulo}: o manifesto não traz o total do sistema atual.`
          : `${c.rotulo}: o sistema atual tem ${c.sistemaAtual} e o pacote trouxe ${c.lidos}${c.recusados ? ` (${c.recusados} recusados)` : ""}.`,
    });
  if (pacote.recusadas.length)
    problemas.push({
      bloqueia: true,
      texto: `${pacote.recusadas.length} ${pacote.recusadas.length === 1 ? "linha não pôde ser lida" : "linhas não puderam ser lidas"}: corrija no pacote (lista abaixo).`,
    });

  // Status: tabela ou escolha.
  const status = new Map<string, CorrespondenciaDeStatus>();
  const anotar = (
    tipo: TipoDeStatus,
    antigo: string,
    novo: string | null,
    daTabela: boolean,
  ) => {
    const k = chaveDoStatus(tipo, antigo);
    const atual = status.get(k);
    if (atual) atual.quantidade++;
    else
      status.set(k, {
        tipo,
        antigo: antigo.trim(),
        novo,
        quantidade: 1,
        daTabela,
      });
  };
  for (const os of [...r.os_internas, ...r.os_terceirizadas]) {
    const s = statusDoRegistro("os", os.status, ctx.mapeamento);
    anotar(
      "os",
      os.status,
      s ? STATUS[s.status] : null,
      !!mapearStatusOS(os.status),
    );
  }
  for (const t of r.tarefas) {
    const s = statusDoRegistro("tarefa", t.status, ctx.mapeamento);
    anotar(
      "tarefa",
      t.status,
      s
        ? `${STATUS[s.status]}${s.convertida_em_os ? " (ligada à OS)" : ""}`
        : null,
      !!mapearStatusTarefa(t.status),
    );
  }
  for (const v of r.vistorias) {
    const s = statusDaVistoria(v.status, ctx.mapeamento);
    anotar(
      "vistoria",
      v.status,
      s ? STATUS_VISTORIA[s] : null,
      !!mapearStatusVistoria(v.status),
    );
  }
  const semStatus = [...status.values()].filter((s) => !s.novo);
  if (semStatus.length)
    problemas.push({
      bloqueia: true,
      texto: `${semStatus.length} ${semStatus.length === 1 ? "status antigo não está" : "status antigos não estão"} na tabela: escolha como cada um fica.`,
    });

  // Números de OS e duplicidades.
  const decisoes = decidirNumeros(pacote, ctx.numerosNoModulo);
  for (const tipo of ["os_internas", "os_terceirizadas"] as const) {
    const vistos = new Set<number>();
    for (const os of r[tipo]) {
      if (vistos.has(os.numero))
        problemas.push({
          bloqueia: true,
          texto: `${TIPOS_DE_REGISTRO[tipo]}: o número ${os.numero} aparece mais de uma vez.`,
        });
      vistos.add(os.numero);
    }
  }
  const numeros = [...decisoes]
    .filter(([, d]) => d !== "manter")
    .map(([k, decisao]) => {
      const [tipo, n] = k.split(":");
      return {
        numero: Number(n),
        tipo: TIPOS_DE_REGISTRO[tipo as TipoDeRegistro],
        decisao,
      };
    });
  const novos = numeros.filter((n) => n.decisao === "numero_novo").length;
  if (novos)
    problemas.push({
      bloqueia: false,
      texto: `${novos} OS ${novos === 1 ? "tem um número que já é usado" : "têm números que já são usados"} no módulo: ${novos === 1 ? "entra" : "entram"} com número novo, e o antigo fica guardado na OS.`,
    });

  // Vistorias: o código do laudo é mantido.
  const codigos = new Set<string>();
  for (const v of r.vistorias) {
    const c = v.codigo.trim().toUpperCase();
    if (codigos.has(c))
      problemas.push({
        bloqueia: true,
        texto: `Vistoria ${c} aparece mais de uma vez.`,
      });
    codigos.add(c);
    const noModulo = ctx.codigosNoModulo.get(c);
    if (noModulo && noModulo.legado_id !== c)
      problemas.push({
        bloqueia: true,
        texto: `Já existe a vistoria ${c} criada no módulo. Troque o código dela antes de importar (o laudo antigo mantém o código).`,
      });
    if (!tipoDaVistoria(v.tipo))
      problemas.push({
        bloqueia: false,
        texto: `Vistoria ${c}: tipo "${v.tipo}" não reconhecido; entra como extraordinária.`,
      });
  }

  // Técnicos: valor por minuto e usuário.
  const tecnicosSemValor = r.tecnicos
    .filter((t) => t.valor_minuto == null)
    .map((t) => t.nome);
  if (tecnicosSemValor.length)
    problemas.push({
      bloqueia: false,
      texto: `${tecnicosSemValor.length} ${tecnicosSemValor.length === 1 ? "técnico sem" : "técnicos sem"} valor por minuto: entram e ficam para completar em Parâmetros.`,
    });
  const tecnicosLigados = r.tecnicos.flatMap((t) => {
    const usuarioId = usuarioPeloNome(t.nome, ctx.usuarios);
    return usuarioId ? [{ nome: t.nome, usuarioId }] : [];
  });
  const idsTecnicos = new Set(r.tecnicos.map((t) => t.id));
  const tecnicoFaltando = new Set<string>();
  for (const os of r.os_internas)
    for (const s of os.sessoes)
      for (const t of s.tecnicos)
        if (!idsTecnicos.has(t)) tecnicoFaltando.add(t);
  if (tecnicoFaltando.size)
    problemas.push({
      bloqueia: true,
      texto: `Sessões citam técnicos que não estão em tecnicos (${[...tecnicoFaltando].slice(0, 5).join(", ")}${tecnicoFaltando.size > 5 ? "…" : ""}).`,
    });

  // Custo recalculado × antigo.
  const diferencasDeCusto: DiferencaDeCusto[] = [];
  let custosConferidos = 0;
  for (const tipo of ["os_internas", "os_terceirizadas"] as const)
    for (const os of r[tipo]) {
      if (!os.legado || Object.values(os.legado).every((v) => v == null))
        continue;
      custosConferidos++;
      const d = compararCusto(
        os.numero,
        tipo,
        os.legado,
        calcularOS(entradaDoCalculo(os, r.tecnicos)),
      );
      if (d) diferencasDeCusto.push(d);
      if (os.rateio && !regraDeRateio(os.rateio.regra))
        problemas.push({
          bloqueia: false,
          texto: `OS ${os.numero}: regra de rateio "${os.rateio.regra}" não reconhecida; entra fora do rateio.`,
        });
    }
  if (diferencasDeCusto.length)
    problemas.push({
      bloqueia: false,
      texto: `${diferencasDeCusto.length} OS com custo ou minutos diferentes do sistema atual (lista abaixo). Os dois valores ficam guardados.`,
    });

  // Fotos citadas sem arquivo: a OS entra e a foto fica na lista.
  const fotosFaltando: Previa["fotosFaltando"] = [];
  let fotos = 0;
  const conferirFoto = (onde: string, arquivo: string | undefined) => {
    if (!arquivo) return;
    fotos++;
    if (!ctx.acharArquivo(arquivo)) fotosFaltando.push({ onde, arquivo });
  };
  for (const os of r.os_internas)
    for (const f of os.fotos) conferirFoto(`OS ${os.numero}`, f.arquivo);
  for (const os of r.os_terceirizadas)
    for (const f of os.fotos) conferirFoto(`OS ${os.numero}`, f.arquivo);
  for (const v of r.vistorias) {
    for (const a of v.ambientes)
      for (const f of a.fotos)
        conferirFoto(`Vistoria ${v.codigo} · ${a.titulo}`, f.arquivo);
    conferirFoto(`Vistoria ${v.codigo} · assinatura`, v.assinatura_locador);
    conferirFoto(`Vistoria ${v.codigo} · assinatura`, v.assinatura_locatario);
  }
  if (fotosFaltando.length)
    problemas.push({
      bloqueia: false,
      texto: `${fotosFaltando.length} ${fotosFaltando.length === 1 ? "foto citada não está" : "fotos citadas não estão"} na pasta de fotos: os registros entram sem elas (lista abaixo).`,
    });

  // Vínculos que não fecham (não impedem: entram sem o vínculo).
  const numerosOs = new Set([
    ...r.os_internas.map((o) => o.numero),
    ...r.os_terceirizadas.map((o) => o.numero),
  ]);
  const semOs = r.tarefas.filter(
    (t) => t.os_numero && !numerosOs.has(t.os_numero),
  );
  if (semOs.length)
    problemas.push({
      bloqueia: false,
      texto: `${semOs.length} ${semOs.length === 1 ? "tarefa convertida aponta" : "tarefas convertidas apontam"} para OS fora do pacote: entram sem o vínculo.`,
    });
  const tarefas = new Set(r.tarefas.map((t) => t.id));
  const soltos = r.registros.filter(
    (x) =>
      !(x.os_numero && numerosOs.has(x.os_numero)) &&
      !(x.tarefa_id && tarefas.has(x.tarefa_id)),
  ).length;
  if (soltos)
    problemas.push({
      bloqueia: false,
      texto: `${soltos} ${soltos === 1 ? "registro de atividade não é" : "registros de atividade não são"} de nenhuma OS ou tarefa do pacote e não entram (a linha do tempo é de cada chamado).`,
    });
  const equipamentos = new Set(r.equipamentos.map((e) => e.id));
  const semEquip = r.os_internas.filter(
    (o) => o.equipamento && !equipamentos.has(o.equipamento),
  ).length;
  if (semEquip)
    problemas.push({
      bloqueia: false,
      texto: `${semEquip} OS ${semEquip === 1 ? "cita" : "citam"} equipamento fora do pacote: entram sem o ativo.`,
    });

  return {
    sistema: pacote.manifesto.sistema ?? null,
    geradoEm: pacote.manifesto.gerado_em ?? null,
    contagens,
    status: [...status.values()].sort(
      (a, b) => a.tipo.localeCompare(b.tipo) || b.quantidade - a.quantidade,
    ),
    custosConferidos,
    diferencasDeCusto,
    fotos,
    fotosFaltando,
    tecnicosSemValor,
    tecnicosLigados,
    numeros,
    problemas,
    recusadas: pacote.recusadas,
    podeConfirmar: !problemas.some((p) => p.bloqueia),
  };
}
