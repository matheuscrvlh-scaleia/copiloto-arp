import { formatarData, formatarNumero } from "@arp/shared/formato";
import type {
  ImportacaoGravada,
  ImportacaoNaListaSu,
  PreviaSu,
  ResumoGravado,
} from "@arp/shared/sustentabilidade/contratos/importacoes";
import {
  type DefinicaoFormulario,
  definicaoSchema,
} from "@arp/shared/sustentabilidade/formulario/tipos";
import {
  type Aba,
  type Aviso,
  abasDoArquivo,
  type Celula,
  type ContratoParaCasar,
  type Decisao,
  type EntrevistaLida,
  lerAtracoesDasAbas,
  lerEcocoposDasAbas,
  lerEntrevistasDasAbas,
  lerProdutoresDasAbas,
  lerQuiosqueDasAbas,
  lerTourDasAbas,
  normalizar,
  type ParticipacaoLida,
  periodoDe,
  TIPOS_DE_IMPORTACAO,
  type TipoDeImportacao,
} from "@arp/shared/sustentabilidade/importacao/index";
import {
  avisoEmReais,
  contarAvisos,
  descreverLido,
  ehStatusSu,
  resumirConferencias,
} from "@arp/shared/sustentabilidade/importacao-historico";
import {
  abasSemOrcamento,
  aplicarNomes,
  aplicarVinculos,
  type ContratoDaImportacao,
  casarCampos,
  contagemPorResposta,
  DESTINO_DO_TIPO,
  decisoesPendentes,
  type EntrevistaMontada,
  type Escolhas,
  entrevistaDaLinha,
  type LancamentoMontado,
  lancamentoDaLinha,
  lerEscolhas,
  nomesNovos,
  rotuloDaColuna,
  somaDosReais,
  type TipoDeLancamento,
  totaisPorAno,
  totaisPorMes,
} from "@arp/shared/sustentabilidade/importacao-linhas";
import { questionarioV1 } from "@arp/shared/sustentabilidade/questionario-inicial";
import { z } from "zod";
import type { Contexto } from "@/contexto";
import { lerArquivo } from "@/infra/arquivos";
import { banco } from "@/infra/banco";
import { nomesDeUsuarios, podeAgora } from "./acesso";
import { parametrosDaEntrevista } from "./base.service";
import * as repo from "./importacoes.repository";

// Importações do histórico (spec 4.10): a lista (com quem importou e
// quando) e a prévia. A prévia relê o arquivo guardado a cada abertura (a
// leitura é determinística) e aplica as escolhas gravadas em
// `importacoes.decisoes`; as linhas só são gravadas na confirmação
// (acoes/importacoes.ts), logo antes de `confirmar_importacao`. Assim as
// telas do módulo nunca veem linha de prévia (o RLS e as consultas delas
// não filtram por situação da importação).
//
// Leitura com a sessão (RLS "Importar histórico"). Service role só depois de
// podeAgora("sustentabilidade.importar"), para o que o RLS não abre a quem
// importa: o nome dos programas e as entrevistas já gravadas (contrato e
// data, para bloquear a duplicidade).

export const BUCKET_SU = "sustentabilidade" as const;
const PERMISSAO = "sustentabilidade.importar" as const;
const LINHAS_NA_PREVIA = 300;
const AVISOS_GRAVADOS = 500;

export const ehTipoDeImportacao = (t: string): t is TipoDeImportacao =>
  t in TIPOS_DE_IMPORTACAO;

const arquivoSchema = z.object({
  nome: z.string().catch("arquivo"),
  caminho: z.string().catch(""),
  bytes: z.number().catch(0),
});
export type ArquivoDaImportacao = z.infer<typeof arquivoSchema>;
export const lerArquivoGravado = (j: unknown): ArquivoDaImportacao =>
  arquivoSchema.parse(j && typeof j === "object" ? j : {});

export type { ImportacaoGravada, ImportacaoNaListaSu, PreviaSu, ResumoGravado };

const resumoSchema = z.object({
  texto: z.string().catch(""),
  lidas: z.number().catch(0),
  linhas: z.number().catch(0),
  periodo: z
    .object({ de: z.string().nullable(), ate: z.string().nullable() })
    .catch({ de: null, ate: null }),
  conferencias: z.array(z.string()).catch([]),
  avisos: z
    .object({ erro: z.number(), aviso: z.number(), info: z.number() })
    .catch({ erro: 0, aviso: 0, info: 0 }),
  destino: z.string().optional().catch(undefined),
});
export const lerResumoGravado = (j: unknown): ResumoGravado =>
  resumoSchema.parse(j && typeof j === "object" ? j : {});

const avisosSchema = z.array(
  z.object({
    nivel: z.enum(["erro", "aviso", "info"]),
    aba: z.string().optional(),
    linha: z.number().optional(),
    mensagem: z.string(),
  }),
);
export const lerAvisosGravados = (j: unknown): Aviso[] => {
  const r = avisosSchema.safeParse(j);
  return r.success ? r.data : [];
};

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------

type LinhaDaLista = Awaited<ReturnType<typeof repo.importacoes>>[number];

async function naLista(
  ctx: Contexto,
  linhas: LinhaDaLista[],
): Promise<ImportacaoNaListaSu[]> {
  const nomes = await nomesDeUsuarios(
    ctx,
    linhas.flatMap((l) => [l.criado_por, l.confirmado_por, l.desfeito_por]),
    [PERMISSAO],
  );
  const nome = (id: string | null) => (id ? (nomes.get(id) ?? null) : null);
  return linhas.flatMap((l) =>
    ehTipoDeImportacao(l.tipo) && ehStatusSu(l.status)
      ? [
          {
            id: l.id,
            tipo: l.tipo,
            status: l.status,
            arquivo: lerArquivoGravado(l.arquivo).nome,
            resumo: lerResumoGravado(l.resumo),
            criadoEm: l.criado_em,
            criadoPor: nome(l.criado_por),
            confirmadoEm: l.confirmado_em,
            confirmadoPor: nome(l.confirmado_por),
            desfeitoEm: l.desfeito_em,
            desfeitoPor: nome(l.desfeito_por),
            minha: l.criado_por === ctx.usuario.id,
          },
        ]
      : [],
  );
}

/** Importações do módulo, da mais nova para a mais antiga (RLS: importar). */
export async function importacoesSu(
  ctx: Contexto,
): Promise<ImportacaoNaListaSu[]> {
  const linhas = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.importacoes(tx),
  );
  return naLista(ctx, linhas);
}

/** Uma importação como está no banco (para a página de detalhe). */
export async function importacaoSu(
  ctx: Contexto,
  id: string,
): Promise<ImportacaoGravada | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const l = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.importacao(tx, id),
  );
  if (!l) return null;
  const [base] = await naLista(ctx, [l]);
  if (!base) return null;
  return {
    ...base,
    avisos: lerAvisosGravados(l.avisos),
    escolhas: lerEscolhas(l.decisoes),
    substitui: l.substitui,
  };
}

// ---------------------------------------------------------------------------
// Prévia
// ---------------------------------------------------------------------------

/** O que a confirmação grava (só no servidor). */
export type Gravacao =
  | {
      tipo: "entrevistas";
      versao: number;
      entrevistas: EntrevistaMontada[];
    }
  | {
      tipo: TipoDeLancamento;
      programa_id: string;
      formulario_id: string;
      versao: number;
      lancamentos: (LancamentoMontado & { data: string })[];
      cadastro: {
        campo_id: string;
        nomes: { valor: string; normalizado: string }[];
      } | null;
    };

export interface Montagem {
  previa: PreviaSu;
  gravacao: Gravacao | null;
  resumo: ResumoGravado;
  /** Avisos para `importacoes.avisos` (sem os que têm reais). */
  avisosGravados: Aviso[];
}

export interface EntradaDaPrevia {
  id: string;
  tipo: TipoDeImportacao;
  bytes: Uint8Array;
  escolhas: Escolhas;
  /** Importação que esta substitui (as entrevistas dela não contam como repetidas). */
  substitui: string | null;
  podeValores: boolean;
}

/**
 * Lê o arquivo de uma prévia aberta e monta o que ela mostra e o que a
 * confirmação grava. Só para prévia: a importação confirmada não se relê
 * (as linhas dela já estão no banco e contariam como repetidas).
 */
export async function montarPrevia(
  ctx: Contexto,
  id: string,
): Promise<Montagem | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const imp = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.importacaoBruta(tx, id),
  );
  if (!imp || imp.status !== "previa" || !ehTipoDeImportacao(imp.tipo))
    return null;
  if (!(await podeAgora(ctx, PERMISSAO))) return null;
  const arquivo = lerArquivoGravado(imp.arquivo);
  const bytes = await lerArquivo(BUCKET_SU, arquivo.caminho);
  if (!bytes) return null;
  return previaDoArquivo(ctx, {
    id,
    tipo: imp.tipo,
    bytes,
    escolhas: lerEscolhas(imp.decisoes),
    substitui: imp.substitui,
    podeValores: ctx.permissoes.has("sustentabilidade.valores"),
  });
}

/** Leitura + montagem a partir dos bytes (o envio usa antes de criar a prévia). */
export async function previaDoArquivo(
  ctx: Contexto,
  e: EntradaDaPrevia,
): Promise<Montagem> {
  const { abas, ignoradas } = abasSemOrcamento(await abasDoArquivo(e.bytes));
  const m =
    e.tipo === "entrevistas"
      ? await montarEntrevistas(ctx, e, abas)
      : await montarLancamentos(ctx, e, e.tipo, abas);
  m.previa.ignoradas = ignoradas;
  if (ignoradas.length)
    m.previa.avisos.unshift({
      nivel: "info",
      mensagem: `Abas de orçamento de eventos não são importadas: ${ignoradas.join(", ")}.`,
    });
  const visiveis = e.podeValores
    ? m.previa.avisos
    : m.previa.avisos.filter((a) => !avisoEmReais(a));
  const escondidos = m.previa.avisos.length - visiveis.length;
  if (escondidos)
    visiveis.push({
      nivel: "aviso",
      mensagem: `${formatarNumero(escondidos)} ${escondidos === 1 ? "conferência" : "conferências"} de valores em reais (só para quem tem "Ver valores").`,
    });
  m.previa.avisos = visiveis;
  m.avisosGravados = m.avisosGravados
    .filter((a) => !avisoEmReais(a))
    .slice(0, AVISOS_GRAVADOS);
  const contagem = contarAvisos(m.previa.avisos);
  m.resumo = {
    ...m.resumo,
    texto: descreverLido(e.tipo, m.previa.entram, m.previa.periodo),
    lidas: m.previa.lidas,
    linhas: m.previa.entram,
    periodo: m.previa.periodo,
    conferencias: resumirConferencias(m.previa.decisoes, contagem),
    avisos: contagem,
  };
  return m;
}

const tabelaVazia = (): PreviaSu["tabela"] => ({
  colunas: [],
  numeros: [],
  linhas: [],
  total: 0,
});

function previaBase(
  e: EntradaDaPrevia,
  lidas: number,
  avisos: Aviso[],
  decisoes: Decisao[],
): PreviaSu {
  return {
    id: e.id,
    tipo: e.tipo,
    lidas,
    entram: 0,
    periodo: { de: null, ate: null },
    porMes: [],
    porAno: [],
    quantidade: null,
    avisos,
    decisoes,
    escolhas: e.escolhas,
    pendentes: decisoesPendentes(decisoes, e.escolhas).map((d) => d.id),
    ignoradas: [],
    destino: null,
    contratos: [],
    tabela: tabelaVazia(),
    naoConvertidos: { n: 0, exemplos: [] },
    reais: null,
    conferencias: [],
    bloqueio: null,
  };
}

const RESUMO_VAZIO: ResumoGravado = {
  texto: "",
  lidas: 0,
  linhas: 0,
  periodo: { de: null, ate: null },
  conferencias: [],
  avisos: { erro: 0, aviso: 0, info: 0 },
};

// --- Entrevistas -----------------------------------------------------------

/**
 * O que a prévia das entrevistas lê do banco. As entrevistas já gravadas
 * (contrato e data, para bloquear a duplicidade) vêm pela service role, só
 * depois de conferir "Importar histórico": o RLS não as abre a quem importa.
 */
async function insumosDasEntrevistas(ctx: Contexto, substitui: string | null) {
  const existentes = (await podeAgora(ctx, PERMISSAO))
    ? (await banco.comoServico((tx) => repo.entrevistasSalvas(tx)))
        // Fora as da importação substituída.
        .filter((l) => !substitui || l.importacao_id !== substitui)
        .map((l) => ({ contrato_id: l.contrato_id, data: l.data }))
    : [];
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const contratos: ContratoDaImportacao[] = await repo.contratosParaCasar(tx);
    // Versão 1 do questionário (a do Forms); sem ela no banco, a do código.
    const d = definicaoSchema.safeParse(await repo.questionarioV1(tx));
    const q = { versao: 1, definicao: d.success ? d.data : questionarioV1() };
    return {
      contratos,
      existentes,
      q,
      parametros: await parametrosDaEntrevista(tx),
    };
  });
}

const dataBr = (iso: string | null) => (iso ? formatarData(iso) : "—");

async function montarEntrevistas(
  ctx: Contexto,
  e: EntradaDaPrevia,
  abas: Aba[],
): Promise<Montagem> {
  const { contratos, existentes, q, parametros } = await insumosDasEntrevistas(
    ctx,
    e.substitui,
  );
  const paraCasar: ContratoParaCasar[] = contratos.map((c) => ({
    id: c.id,
    lucs: c.lucs,
    cliente_nome: c.cliente_nome,
  }));
  const lida = lerEntrevistasDasAbas(abas, {
    contratos: paraCasar,
    existentes,
  });
  const previa = previaBase(e, lida.linhas.length, lida.avisos, lida.decisoes);
  const ap = aplicarVinculos(
    lida.linhas,
    lida.decisoes,
    e.escolhas.vinculos,
    existentes,
  );
  for (const [linha, motivo] of ap.repetidas)
    previa.avisos.push({
      nivel: "erro",
      linha,
      mensagem: `Com o contrato escolhido, a entrevista ${motivo}: esta linha não entra.`,
    });
  const porId = new Map(contratos.map((c) => [c.id, c]));
  const montadas = ap.linhas.flatMap((l) => {
    const c = l.contrato_id ? porId.get(l.contrato_id) : undefined;
    const m = c ? entrevistaDaLinha(l, c, q.definicao, parametros) : null;
    return m ? [m] : [];
  });
  const naoConvertidas = montadas.flatMap((m) =>
    m.pendentes.map(
      (p) => `Linha ${m.linha}, ${p.pergunta_id}: "${p.valor}" (${p.motivo})`,
    ),
  );

  previa.entram = montadas.length;
  previa.periodo = periodoDe(montadas.map((m) => m.data));
  previa.porMes = totaisPorMes(montadas);
  previa.porAno = totaisPorAno(previa.porMes);
  previa.naoConvertidos = {
    n: naoConvertidas.length,
    exemplos: naoConvertidas.slice(0, 20),
  };
  if (lida.decisoes.some((d) => d.tipo === "vincular_contrato"))
    previa.contratos = contratos.map((c) => ({
      id: c.id,
      rotulo: `${c.cliente_nome}${c.lucs.length ? ` (LUC ${c.lucs.join(", ")})` : ""}`,
    }));
  previa.conferencias = conferenciasDasEntrevistas(lida.linhas, q.definicao);

  const nomeDoContrato = (id: string | null) =>
    id ? (porId.get(id)?.cliente_nome ?? "—") : "A vincular";
  const tipoTexto = (t: EntrevistaLida["tipo"]) =>
    t === "atualizacao" ? "Atualização" : t === "primeira" ? "1ª vez" : "—";
  const comContrato = new Map(ap.linhas.map((l) => [l.linha, l.contrato_id]));
  previa.tabela = {
    colunas: ["Linha", "Data", "Empresa", "LUC", "Contrato", "Situação"],
    numeros: [true, false, false, false, false, false],
    linhas: lida.linhas.slice(0, LINHAS_NA_PREVIA).map((l) => ({
      chave: `${l.aba}:${l.linha}`,
      celulas: [
        String(l.linha),
        dataBr(l.data),
        l.empresa ?? "—",
        l.luc_texto ?? "—",
        nomeDoContrato(comContrato.get(l.linha) ?? l.contrato_id),
        tipoTexto(l.tipo),
      ],
    })),
    total: lida.linhas.length,
  };
  if (!montadas.length && !previa.pendentes.length)
    previa.bloqueio = "Nenhuma entrevista do arquivo pode entrar.";

  return {
    previa,
    gravacao: { tipo: "entrevistas", versao: q.versao, entrevistas: montadas },
    resumo: { ...RESUMO_VAZIO, destino: "Entrevistas (questionário versão 1)" },
    avisosGravados: previa.avisos,
  };
}

/** Grau de conhecimento (pergunta 7) e PGRS (16), como no plano de testes. */
function conferenciasDasEntrevistas(
  linhas: EntrevistaLida[],
  d: DefinicaoFormulario,
): PreviaSu["conferencias"] {
  const perguntas = d.secoes.flatMap((s) => s.perguntas);
  return ["7", "16"].flatMap((n) => {
    const p = perguntas.find((x) => x.numero.trim() === n);
    return p
      ? [
          {
            titulo: `${n}. ${p.texto}`,
            itens: contagemPorResposta(linhas, `q${n}`),
          },
        ]
      : [];
  });
}

// --- Lançamentos dos programas --------------------------------------------

interface FormularioDoPrograma {
  id: string;
  nome: string;
  programa_id: string;
  versao: number;
}

/** Programa e formulário: o escolhido na prévia; sem escolha, pelo nome. */
export function escolherDestino(
  tipo: TipoDeLancamento,
  e: Pick<Escolhas, "programa_id" | "formulario_id">,
  programas: { id: string; nome: string }[],
  formularios: FormularioDoPrograma[],
): { programa_id: string | null; formulario: FormularioDoPrograma | null } {
  const padrao = DESTINO_DO_TIPO[tipo];
  const programa_id =
    (e.programa_id && programas.some((p) => p.id === e.programa_id)
      ? e.programa_id
      : programas.find(
          (p) => normalizar(p.nome) === normalizar(padrao.programa),
        )?.id) ?? null;
  const doPrograma = formularios.filter((f) => f.programa_id === programa_id);
  const formulario =
    doPrograma.find((f) => f.id === e.formulario_id) ??
    doPrograma.find(
      (f) => normalizar(f.nome) === normalizar(padrao.formulario),
    ) ??
    null;
  return { programa_id, formulario };
}

const formatarCelula = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number")
    return formatarNumero(v, Number.isInteger(v) ? 0 : 2);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v))
    return formatarData(v);
  return String(v);
};

/**
 * O que a prévia dos lançamentos lê do banco: programas (pela service role,
 * depois de conferir "Importar histórico": o RLS de programas não abre a quem
 * importa), formulários publicados, a definição do escolhido e, nos
 * produtores, os nomes já cadastrados.
 */
async function insumosDosLancamentos(
  ctx: Contexto,
  tipo: TipoDeLancamento,
  escolhas: Escolhas,
) {
  const programas = (await podeAgora(ctx, PERMISSAO))
    ? await banco.comoServico((tx) => repo.programas(tx))
    : [];
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const formularios: FormularioDoPrograma[] = (
      await repo.formulariosPublicados(tx)
    ).flatMap((f) =>
      f.programa_id
        ? [
            {
              id: f.id,
              nome: f.nome,
              programa_id: f.programa_id,
              versao: f.versao_publicada,
            },
          ]
        : [],
    );
    const escolha = escolherDestino(tipo, escolhas, programas, formularios);
    const lida = escolha.formulario
      ? definicaoSchema.safeParse(
          await repo.definicaoDaVersao(
            tx,
            escolha.formulario.id,
            escolha.formulario.versao,
          ),
        )
      : null;
    const definicao = lida?.success ? lida.data : null;
    const casamento = definicao ? casarCampos(tipo, definicao) : null;
    const campoProdutor = casamento?.porColuna.produtor;
    const cadastro =
      tipo === "produtores" && escolha.programa_id && campoProdutor
        ? new Map(
            (
              await repo.cadastroAtual(
                tx,
                escolha.programa_id,
                campoProdutor.id,
              )
            ).map((l) => [l.normalizado, l.valor]),
          )
        : new Map<string, string>();
    return { programas, formularios, escolha, definicao, casamento, cadastro };
  });
}

async function montarLancamentos(
  ctx: Contexto,
  e: EntradaDaPrevia,
  tipo: TipoDeLancamento,
  abas: Aba[],
): Promise<Montagem> {
  const { programas, formularios, escolha, definicao, casamento, cadastro } =
    await insumosDosLancamentos(ctx, tipo, e.escolhas);

  // O leitor de cada tipo (o quiosque padroniza o público pela lista do formulário).
  const publicos = casamento?.porColuna.publico?.opcoes
    .filter((o) => o.ativa)
    .map((o) => o.texto);
  const lida =
    tipo === "atracoes"
      ? lerAtracoesDasAbas(abas)
      : tipo === "produtores"
        ? lerProdutoresDasAbas(abas)
        : tipo === "ecocopos"
          ? lerEcocoposDasAbas(abas)
          : tipo === "quiosque"
            ? lerQuiosqueDasAbas(abas, { publicos })
            : lerTourDasAbas(abas);
  const previa = previaBase(e, lida.linhas.length, lida.avisos, lida.decisoes);

  const campoProdutor = casamento?.porColuna.produtor;
  let linhas = lida.linhas as unknown as Record<string, unknown>[];
  if (tipo === "produtores")
    linhas = aplicarNomes(
      lida.linhas as ParticipacaoLida[],
      lida.decisoes,
      e.escolhas.nomes,
      cadastro,
    ) as unknown as Record<string, unknown>[];

  const montados = casamento
    ? linhas.map((l) => lancamentoDaLinha(casamento, l))
    : [];
  const comData = montados.filter(
    (m): m is LancamentoMontado & { data: string } => m.data !== null,
  );
  const semData = montados.length - comData.length;
  if (semData)
    previa.avisos.push({
      nivel: "erro",
      mensagem: `${formatarNumero(semData)} ${semData === 1 ? "linha sem data não entra" : "linhas sem data não entram"}.`,
    });
  const naoConvertidos = comData.flatMap((m) =>
    m.pendentes.map(
      (p) =>
        `${formatarData(m.data)}, ${rotuloDaColuna(tipo, p.coluna)}: "${p.valor}" (${p.motivo})`,
    ),
  );

  const quantidade =
    tipo === "ecocopos"
      ? { coluna: "quantidade", rotulo: "Quantidade" }
      : tipo === "tour"
        ? { coluna: "participantes", rotulo: "Participantes" }
        : null;
  const qtdId = quantidade && casamento?.porColuna[quantidade.coluna]?.id;
  previa.entram = comData.length;
  previa.periodo = periodoDe(comData.map((m) => m.data));
  previa.porMes = totaisPorMes(
    comData.map((m) => ({
      data: m.data,
      quantidade: qtdId ? (m.valores[qtdId] as number | undefined) : null,
    })),
  );
  previa.porAno = totaisPorAno(previa.porMes);
  previa.quantidade = quantidade?.rotulo ?? null;
  previa.naoConvertidos = {
    n: naoConvertidos.length,
    exemplos: naoConvertidos.slice(0, 20),
  };

  if (e.podeValores && casamento) {
    const soma = somaDosReais(comData);
    previa.reais = Object.entries(casamento.porColuna)
      .filter(([, p]) => p.tipo === "reais")
      .map(([coluna, p]) => ({
        rotulo: rotuloDaColuna(tipo, coluna),
        total: soma[p.id] ?? 0,
      }));
  }

  const colunas = Object.keys(
    casamento ? { ...casamento.porColuna } : {},
  ).filter((c) => e.podeValores || casamento?.porColuna[c]?.tipo !== "reais");
  previa.destino = {
    programas,
    formularios: formularios.map((f) => ({
      id: f.id,
      nome: f.nome,
      programa_id: f.programa_id,
    })),
    programa_id: escolha.programa_id,
    formulario_id: escolha.formulario?.id ?? null,
    colunas: casamento
      ? [
          ...Object.entries(casamento.porColuna).map(([coluna, p]) => ({
            coluna,
            rotulo: rotuloDaColuna(tipo, coluna),
            campo: p.texto,
            reais: p.tipo === "reais",
          })),
          ...casamento.semCampo.map((coluna) => ({
            coluna,
            rotulo: rotuloDaColuna(tipo, coluna),
            campo: null,
            reais: false,
          })),
        ]
      : [],
    semColuna: casamento?.semColuna.map((p) => p.texto) ?? [],
  };
  previa.tabela = {
    colunas: colunas.map((c) => rotuloDaColuna(tipo, c)),
    numeros: colunas.map((c) =>
      ["numero", "reais", "numero_unidade"].includes(
        casamento?.porColuna[c]?.tipo ?? "",
      ),
    ),
    linhas: linhas.slice(0, LINHAS_NA_PREVIA).map((l, i) => ({
      chave: `${String(l.aba ?? "")}:${String(l.linha ?? i)}:${String(l.coluna ?? "")}`,
      celulas: colunas.map((c) => formatarCelula(l[c] as Celula)),
    })),
    total: linhas.length,
  };

  const nomeDoPrograma = programas.find(
    (p) => p.id === escolha.programa_id,
  )?.nome;
  if (!escolha.programa_id)
    previa.bloqueio = `Escolha o programa (não há programa "${DESTINO_DO_TIPO[tipo].programa}").`;
  else if (!escolha.formulario)
    previa.bloqueio = `Escolha o formulário do programa (não há formulário publicado "${DESTINO_DO_TIPO[tipo].formulario}" em ${nomeDoPrograma ?? "o programa"}).`;
  else if (!definicao || !casamento)
    previa.bloqueio = "Não foi possível ler a versão publicada do formulário.";
  else if (!Object.keys(casamento.porColuna).includes("data"))
    previa.bloqueio =
      "O formulário escolhido não tem campo de data: os lançamentos ficariam sem a data do fato.";
  else if (!comData.length)
    previa.bloqueio = "Nenhuma linha do arquivo pode entrar.";

  const gravacao: Gravacao | null =
    escolha.programa_id && escolha.formulario && casamento && !previa.bloqueio
      ? {
          tipo,
          programa_id: escolha.programa_id,
          formulario_id: escolha.formulario.id,
          versao: escolha.formulario.versao,
          lancamentos: comData,
          cadastro:
            tipo === "produtores" && campoProdutor
              ? {
                  campo_id: campoProdutor.id,
                  nomes: nomesNovos(
                    linhas as unknown as ParticipacaoLida[],
                    cadastro,
                  ),
                }
              : null,
        }
      : null;

  return {
    previa,
    gravacao,
    resumo: {
      ...RESUMO_VAZIO,
      destino:
        nomeDoPrograma && escolha.formulario
          ? `${nomeDoPrograma} › ${escolha.formulario.nome}`
          : undefined,
    },
    avisosGravados: previa.avisos,
  };
}
