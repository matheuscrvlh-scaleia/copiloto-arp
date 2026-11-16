import { formatarData } from "@arp/shared/formato";
import {
  custoPorMes,
  descreverLocal,
  faixasDosParametros,
  faltasNoCadastro,
  idadeEmAnos,
  lerChecklist,
  ordenarPorPeso,
  proximaDataDoPlano,
  tempoMedioDeReparoMin,
  umAnoAntes,
} from "@arp/shared/os/ativos";
import { lerFiltroAtivos, precisaDoSinal } from "@arp/shared/os/ativos-lista";
import type {
  AtivoNaLista,
  EntradaAtivo,
  EntradaCategoriaAtivo,
  EntradaPlano,
  FichaDoAtivo,
  OpcoesDoCadastro,
  OrdemDoAtivo,
  RespostaAtivos,
  ResumoAtivo,
} from "@arp/shared/os/contratos/ativos";
import { entradaAtivo, ROTULOS_ATIVO } from "@arp/shared/os/contratos/ativos";
import type { Planilha } from "@arp/shared/os/contratos/visoes";
import type { ColunaExportar } from "@arp/shared/os/exportar";
import {
  intervalo,
  paginaDaUrl,
  totalDePaginas,
} from "@arp/shared/os/paginacao";
import { rotaAtivo } from "@arp/shared/os/rotas";
import { SITUACOES_ATIVO } from "@arp/shared/os/rotulos";
import {
  diasParado,
  type FaixasSinal,
  type ResultadoSinal,
  SINAIS,
  sinalDoAtivo,
  tempoMedioEntreFalhasDias,
} from "@arp/shared/os/sinal";
import { hojeEmBrasilia } from "@arp/shared/os/tempo";
import { type Contexto, exigir, pode } from "@/contexto";
import {
  ErroDaApi,
  ErroDeNegocio,
  ErroDePermissao,
  ErroDeValidacao,
  ErroNaoEncontrado,
} from "@/erros";
import type { ArquivoRecebido } from "@/http/formulario";
import { banco, type Tx } from "@/infra/banco";
import type { OsSituacaoAtivo } from "@/infra/banco/tipos";
import { log } from "@/infra/log";
import type { Ativo } from "./ativos.repository";
import * as repo from "./ativos.repository";
import { criarPreventiva } from "./ativos-preventivas.service";
import { listasDeSaida, saidasDoAtivo } from "./ativos-saidas.service";
import * as base from "./base.repository";
import {
  caminhoDoArquivo,
  enviarArquivo,
  pessoas as pessoasDoModulo,
  removerArquivos,
  urlDoSistema,
  urlsAssinadas,
} from "./base.service";
import { lojasDoModulo } from "./lojas.repository";
import { GRADE, gerarEtiquetas, POR_FOLHA } from "./pdf/etiquetas";
import { validar } from "./validar";

// Ativos (4.11): lista, decisão de troca, ficha, cadastro, situação e baixa,
// anexos, planos preventivos, categorias e etiquetas. Tudo pela sessão (RLS:
// os.ativos para ver, os.ativos_gerenciar para gravar); só o arquivo vai ao
// disco, depois que a linha de os.anexos passou pelo RLS. O custo por ativo
// vem de os.resumo_ativos (soma de todas as OS do ativo, mesmo as de setores
// que a pessoa não vê); a linha do tempo e o gráfico mês a mês mostram as OS
// que ela vê. Valores em reais só saem com os.custos.

const SEM_PERMISSAO = "Você não tem permissão para gerenciar ativos.";

/** Quem vê a tela de Ativos. */
function exigirVer(ctx: Contexto): void {
  if (!pode(ctx, "os.ativos") && !pode(ctx, "os.ativos_gerenciar"))
    throw new ErroDePermissao();
}

/** Gravações dos ativos: os.ativos_gerenciar (conferida antes do formulário). */
export function exigirGerente(ctx: Contexto): void {
  if (!pode(ctx, "os.ativos_gerenciar"))
    throw new ErroDePermissao(SEM_PERMISSAO);
}

/** Sem os.custos, os reais nem saem da API. */
function comReais(a: Ativo, verCustos: boolean): Ativo {
  return verCustos ? a : { ...a, compra_valor: null, valor_reposicao: null };
}

// ---------------------------------------------------------------------------
// Resumo e sinal
// ---------------------------------------------------------------------------

const RESUMO_VAZIO: ResumoAtivo = {
  custo12m: 0,
  custoTotal: 0,
  corretivas12m: 0,
  preventivas12m: 0,
  osAbertas: 0,
  ultimaOs: null,
};

async function resumos(
  tx: Tx,
  hoje: string,
  ativoId?: string,
): Promise<Map<string, ResumoAtivo>> {
  const linhas = await repo.resumos(tx, umAnoAntes(hoje), ativoId);
  return new Map(
    linhas.map((r) => [
      r.ativo_id,
      {
        custo12m: Number(r.custo_periodo),
        custoTotal: Number(r.custo_total),
        corretivas12m: Number(r.corretivas_periodo),
        preventivas12m: Number(r.preventivas_periodo),
        osAbertas: Number(r.os_abertas),
        ultimaOs: r.ultima_os ? new Date(r.ultima_os).toISOString() : null,
      },
    ]),
  );
}

/** Faixas do sinal (Parâmetros) e a antecedência padrão da preventiva. */
async function regrasDosAtivos(tx: Tx) {
  const p = await base.parametros(tx);
  return {
    faixas: faixasDosParametros(p),
    antecedenciaPadrao: p.preventiva_antecedencia_dias,
    avisoGarantiaDias: p.garantia_aviso_dias,
  };
}

const sinalDe = (
  a: Pick<Ativo, "valor_reposicao" | "compra_data" | "vida_util_anos">,
  r: ResumoAtivo,
  faixas: FaixasSinal,
  hoje: string,
): ResultadoSinal =>
  sinalDoAtivo(
    {
      custo12m: r.custo12m,
      valorReposicao: a.valor_reposicao,
      corretivas12m: r.corretivas12m,
      compraData: a.compra_data,
      vidaUtilAnos: a.vida_util_anos,
    },
    faixas,
    hoje,
  );

interface SinalDoAtivo {
  situacao: OsSituacaoAtivo;
  bloco: string | null;
  resumo: ResumoAtivo;
  sinal: ResultadoSinal;
}

/**
 * O sinal de troca de todos os ativos. Ele sai de os.resumo_ativos com
 * regras em TypeScript (faixas dos Parâmetros), então o banco não sabe
 * filtrar nem ordenar por ele: o cartão "Sinal Trocar", o filtro por sinal
 * e a ordem por peso leem as colunas do cálculo de todos (uma linha por
 * ativo, poucas colunas). O resto da lista pagina no banco.
 */
async function sinaisDosAtivos(tx: Tx, hoje: string) {
  const lista = await repo.colunasDoSinal(tx);
  const porResumo = await resumos(tx, hoje);
  const { faixas } = await regrasDosAtivos(tx);
  const porAtivo = new Map<string, SinalDoAtivo>();
  for (const a of lista) {
    const resumo = porResumo.get(a.id) ?? RESUMO_VAZIO;
    porAtivo.set(a.id, {
      situacao: a.situacao,
      bloco: a.bloco,
      resumo,
      sinal: sinalDe(a, resumo, faixas, hoje),
    });
  }
  return { porAtivo, faixas };
}

type Sinais = Awaited<ReturnType<typeof sinaisDosAtivos>>;

async function atrasadasPorAtivo(
  tx: Tx,
  agora: Date,
): Promise<Map<string, number>> {
  const linhas = await repo.atrasadasPorAtivo(tx, agora.toISOString());
  return new Map(
    linhas.flatMap((l) =>
      l.ativo_id ? [[l.ativo_id, Number(l.atrasadas)]] : [],
    ),
  );
}

// ---------------------------------------------------------------------------
// Lista e decisão de troca
// ---------------------------------------------------------------------------

/** Junta categoria, loja, sinal, preventivas e próxima data às linhas. */
async function completar(
  tx: Tx,
  lista: Ativo[],
  hoje: string,
  apoio: {
    sinais: Sinais;
    atrasadas: Map<string, number>;
    categorias: { id: string; nome: string }[];
    verCustos: boolean;
  },
): Promise<AtivoNaLista[]> {
  if (!lista.length) return [];
  const ids = lista.map((a) => a.id);
  const lojaIds = [
    ...new Set(lista.flatMap((a) => (a.loja_id ? [a.loja_id] : []))),
  ];
  const planos = await repo.proximasPreventivas(tx, ids);
  const lojas = lojaIds.length ? await repo.lojasPorId(tx, lojaIds) : [];
  const nomeCategoria = new Map(apoio.categorias.map((c) => [c.id, c.nome]));
  const loja = new Map(lojas.map((l) => [l.id, `${l.luc} ${l.nome}`]));
  const proxima = new Map(planos.map((p) => [p.ativo_id, p.proxima]));
  return lista.map((a): AtivoNaLista => {
    const s = apoio.sinais.porAtivo.get(a.id);
    const resumo = s?.resumo ?? RESUMO_VAZIO;
    const nomeLoja = a.loja_id ? (loja.get(a.loja_id) ?? null) : null;
    return {
      ativo: comReais(a, apoio.verCustos),
      categoria: a.categoria_id
        ? (nomeCategoria.get(a.categoria_id) ?? null)
        : null,
      loja: nomeLoja,
      local: descreverLocal({ ...a, loja: nomeLoja }),
      resumo: apoio.verCustos
        ? resumo
        : { ...resumo, custo12m: 0, custoTotal: 0 },
      sinal: s?.sinal ?? sinalDe(a, resumo, apoio.sinais.faixas, hoje),
      faltas: faltasNoCadastro(a),
      idadeAnos: idadeEmAnos(a.compra_data, hoje),
      proximaPreventiva: proxima.get(a.id) ?? null,
      preventivasAtrasadas: apoio.atrasadas.get(a.id) ?? 0,
    };
  });
}

/**
 * Os ids do filtro na ordem da tela, quando o sinal entra (filtro por
 * sinal ou decisão de troca, do maior peso para o menor): o banco devolve
 * só os ids filtrados e o sinal filtra e ordena aqui.
 */
async function idsPeloSinal(
  tx: Tx,
  f: ReturnType<typeof lerFiltroAtivos>,
  sinais: Sinais,
  atrasadas: Map<string, number>,
): Promise<string[]> {
  const lista = await repo.idsDoFiltro(tx, f, [...atrasadas.keys()]);
  const comSinal = lista
    .map((a) => ({
      id: a.id,
      pesoPct: sinais.porAtivo.get(a.id)?.sinal.pesoPct ?? null,
      sinal: sinais.porAtivo.get(a.id)?.sinal.sinal,
    }))
    .filter((a) => !f.sinal || a.sinal === f.sinal);
  const ordem = f.visao === "decisao" ? ordenarPorPeso(comSinal) : comSinal;
  return ordem.map((a) => a.id);
}

/** Linhas completas de uma lista de ids, na ordem pedida. */
async function ativosNaOrdem(tx: Tx, ids: string[]): Promise<Ativo[]> {
  const porId = new Map(
    (await repo.ativosPorId(tx, ids)).map((a) => [a.id, a]),
  );
  return ids.flatMap((id) => porId.get(id) ?? []);
}

type Busca = Record<string, unknown>;

const textos = (busca: Busca) => {
  const r: Record<string, string | string[] | undefined> = {};
  for (const [k, v] of Object.entries(busca))
    if (typeof v === "string") r[k] = v;
    else if (Array.isArray(v))
      r[k] = v.filter((x): x is string => typeof x === "string");
  return r;
};

/** GET /os/ativos: os cartões do topo e uma página da lista (ou da decisão). */
export function lerAtivos(
  ctx: Contexto,
  busca: Busca,
): Promise<RespostaAtivos> {
  exigirVer(ctx);
  const sp = textos(busca);
  const f = lerFiltroAtivos(sp);
  const pedida = paginaDaUrl(sp.pagina);
  const verCustos = pode(ctx, "os.custos");
  const agora = new Date();
  const hoje = hojeEmBrasilia(agora);
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const sinais = await sinaisDosAtivos(tx, hoje);
    const atrasadas = await atrasadasPorAtivo(tx, agora);
    const categorias = await repo.categoriasDeAtivo(tx);
    const indicadores = await indicadoresDosAtivos(tx, sinais, atrasadas);
    const apoio = { sinais, atrasadas, categorias, verCustos };

    if (precisaDoSinal(f)) {
      const ids = await idsPeloSinal(tx, f, sinais, atrasadas);
      const pagina = Math.min(pedida, totalDePaginas(ids.length));
      const { de, ate } = intervalo(pagina);
      const linhas = await ativosNaOrdem(tx, ids.slice(de, ate + 1));
      return {
        indicadores: { ...indicadores, categorias },
        ativos: await completar(tx, linhas, hoje, apoio),
        total: ids.length,
        pagina,
      };
    }
    const comAtraso = [...atrasadas.keys()];
    const total = await repo.contarDoFiltro(tx, f, comAtraso);
    const pagina = Math.min(pedida, totalDePaginas(total));
    const { de, ate } = intervalo(pagina);
    const linhas = await repo.trechoDoFiltro(tx, f, comAtraso, {
      limite: ate - de + 1,
      pular: de,
    });
    return {
      indicadores: { ...indicadores, categorias },
      ativos: await completar(tx, linhas, hoje, apoio),
      total,
      pagina,
    };
  });
}

/** Os cartões do topo: contagens no banco; o sinal sai do cálculo acima. */
async function indicadoresDosAtivos(
  tx: Tx,
  sinais: Sinais,
  atrasadas: Map<string, number>,
) {
  const emUso = await repo.contarAtivos(tx, (eb) =>
    eb("situacao", "<>", "baixado"),
  );
  const incompletos = await repo.contarAtivos(tx, (eb) =>
    eb.and([eb("situacao", "<>", "baixado"), repo.cadastroIncompleto(eb)]),
  );
  const manutencao = await repo.contarAtivos(tx, (eb) =>
    eb("situacao", "=", "em_manutencao"),
  );
  const parados = await repo.contarAtivos(tx, (eb) =>
    eb("situacao", "=", "parado"),
  );
  const emUsoComAtraso = [...atrasadas].filter(
    ([id]) => sinais.porAtivo.get(id)?.situacao !== "baixado",
  );
  const valores = [...sinais.porAtivo.values()];
  return {
    emUso,
    incompletos,
    manutencao,
    parados,
    atrasadas: emUsoComAtraso.reduce((s, [, n]) => s + n, 0),
    comAtraso: emUsoComAtraso.length,
    trocar: valores.filter(
      (s) => s.situacao !== "baixado" && s.sinal.sinal === "trocar",
    ).length,
    blocos: [
      ...new Set(
        valores.map((s) => s.bloco?.trim()).filter((b): b is string => !!b),
      ),
    ].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true })),
    faixas: sinais.faixas,
  };
}

function colunasExportar(verCustos: boolean): ColunaExportar[] {
  return [
    { titulo: "Código" },
    { titulo: "Nome" },
    { titulo: "Categoria" },
    { titulo: "Local" },
    { titulo: "Situação" },
    { titulo: "Corretivas 12m", numero: true },
    ...(verCustos
      ? [
          { titulo: "Custo 12m (R$)", numero: true, formato: "#,##0.00" },
          { titulo: "Reposição (R$)", numero: true, formato: "#,##0.00" },
        ]
      : []),
    { titulo: "Peso (%)", numero: true, formato: "0.0" },
    { titulo: "Idade (% da vida útil)", numero: true, formato: "0" },
    { titulo: "Sinal" },
  ];
}

/** GET /os/ativos/exportacao: o filtro inteiro, lido só no clique. */
export function exportarAtivos(ctx: Contexto, busca: Busca): Promise<Planilha> {
  if (
    !pode(ctx, "os.exportar") ||
    (!pode(ctx, "os.ativos") && !pode(ctx, "os.ativos_gerenciar"))
  )
    throw new ErroDePermissao("Sem permissão para exportar.");
  const verCustos = pode(ctx, "os.custos");
  const f = lerFiltroAtivos(textos(busca));
  const agora = new Date();
  const hoje = hojeEmBrasilia(agora);
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const sinais = await sinaisDosAtivos(tx, hoje);
    const atrasadas = await atrasadasPorAtivo(tx, agora);
    const categorias = await repo.categoriasDeAtivo(tx);
    const linhas = precisaDoSinal(f)
      ? await ativosNaOrdem(tx, await idsPeloSinal(tx, f, sinais, atrasadas))
      : await repo.trechoDoFiltro(tx, f, [...atrasadas.keys()], {
          limite: 100_000,
          pular: 0,
        });
    const lista = await completar(tx, linhas, hoje, {
      sinais,
      atrasadas,
      categorias,
      verCustos,
    });
    return {
      colunas: colunasExportar(verCustos),
      linhas: lista.map((a) => [
        a.ativo.codigo,
        a.ativo.nome,
        a.categoria ?? "",
        a.local,
        SITUACOES_ATIVO[a.ativo.situacao],
        a.resumo.corretivas12m,
        ...(verCustos ? [a.resumo.custo12m, a.ativo.valor_reposicao] : []),
        a.sinal.pesoPct === null ? null : Math.round(a.sinal.pesoPct * 10) / 10,
        a.sinal.idadePct === null ? null : Math.round(a.sinal.idadePct),
        SINAIS[a.sinal.sinal],
      ]),
    };
  });
}

// ---------------------------------------------------------------------------
// Ficha
// ---------------------------------------------------------------------------

/** GET /os/ativos/:id: a ficha inteira, com saídas e as listas dos planos. */
export function lerFicha(ctx: Contexto, id: string): Promise<FichaDoAtivo> {
  exigirVer(ctx);
  const agora = new Date();
  const hoje = hojeEmBrasilia(agora);
  const verCustos = pode(ctx, "os.custos");
  const podeSaida = pode(ctx, "os.ativos_saida");
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const a = await repo.ativo(tx, id);
    if (!a) throw new ErroNaoEncontrado("Ativo não encontrado.");
    const cats = await repo.categoriasDeAtivo(tx);
    const porAtivo = await resumos(tx, hoje, id);
    const lidasOS = await repo.ordensDoAtivo(tx, id);
    const lidosChamados = await repo.chamadosDoAtivo(tx, id);
    const situacoes = await repo.situacoesDoAtivo(tx, id);
    const planos = await repo.planosDoAtivo(tx, id);
    const anexos = await repo.anexosDoAtivo(tx, id);
    const regras = await regrasDosAtivos(tx);
    const catsChamado = await base.categorias(tx);
    const listaSetores = await base.setores(tx);
    const listaPessoas = await pessoasDoModulo(tx);
    const nomes = new Map(listaPessoas.map((p) => [p.id, p.nome]));
    const [loja] = a.loja_id ? await repo.lojasPorId(tx, [a.loja_id]) : [];
    const fornecedor = a.fornecedor_id
      ? await repo.empresa(tx, a.fornecedor_id)
      : undefined;
    const custos = verCustos
      ? await repo.custosDasOS(
          tx,
          lidasOS.map((c) => c.id),
        )
      : null;
    const saidas = await saidasDoAtivo(tx, id);
    const listas = podeSaida ? await listasDeSaida(tx) : null;

    const preventivaDaCategoria = new Set(
      catsChamado.filter((c) => c.preventiva).map((c) => c.id),
    );
    const visiveis = [
      ...lidasOS,
      ...lidosChamados.map((c) => ({ ...c, plano_id: null })),
    ].sort((x, y) => y.criado_em.localeCompare(x.criado_em));
    const urls = await urlsAssinadas(anexos.map((x) => x.path));
    const ordens: OrdemDoAtivo[] = visiveis.map((c) => ({
      id: c.id,
      numero: c.numero,
      tipo: c.tipo,
      titulo: c.titulo,
      status: c.status,
      prazo: c.prazo,
      criado_em: c.criado_em,
      concluido_em: c.concluido_em,
      aguardando_min: c.aguardando_min,
      causa_falha: c.causa_falha,
      preventiva:
        !!c.plano_id ||
        (!!c.categoria_id && preventivaDaCategoria.has(c.categoria_id)),
      custo: custos?.get(c.id) ?? null,
    }));
    // Corretiva como no resumo do banco: OS não cancelada e não preventiva.
    const corretivas = ordens.filter(
      (o) => o.tipo === "os" && o.status !== "cancelado" && !o.preventiva,
    );
    const listaAnexos = anexos.map((x) => ({
      id: x.id,
      nome: x.nome,
      categoria: x.categoria,
      mime: x.mime,
      tamanho: x.tamanho,
      em: x.em,
      enviadoPor: x.enviado_por ? (nomes.get(x.enviado_por) ?? null) : null,
      url: urls.get(x.path) ?? null,
    }));
    const foto =
      listaAnexos.find(
        (x) => x.categoria === "foto" && x.mime?.startsWith("image/"),
      )?.url ?? null;
    const resumo = porAtivo.get(id) ?? RESUMO_VAZIO;
    const nomeLoja = loja ? `${loja.luc} ${loja.nome}` : null;
    const custoMensal = custos
      ? custoPorMes(
          ordens
            .filter((o) => o.tipo === "os" && o.status !== "cancelado")
            .flatMap((o) =>
              o.custo ? [{ em: o.criado_em, valor: o.custo }] : [],
            ),
          a.compra_data ?? hoje,
          hoje,
        )
      : null;

    const nomeSetor = new Map(listaSetores.map((s) => [s.id, s.nome]));
    const ativas = catsChamado.filter((c) => c.ativo);
    const setorPadrao =
      a.setor_id ?? listaSetores.find((s) => s.ativo)?.id ?? "";
    const categoriaPadrao =
      ativas.find((c) => c.preventiva && c.setor_id === setorPadrao)?.id ??
      ativas.find((c) => c.preventiva)?.id ??
      "";

    return {
      ativo: comReais(a, verCustos),
      categoria: cats.find((c) => c.id === a.categoria_id) ?? null,
      loja: loja ?? null,
      local: descreverLocal({ ...a, loja: nomeLoja }),
      fornecedor: fornecedor ?? null,
      setor: listaSetores.find((s) => s.id === a.setor_id)?.nome ?? null,
      responsavel: a.responsavel_id
        ? (nomes.get(a.responsavel_id) ?? null)
        : null,
      resumo: verCustos ? resumo : { ...resumo, custo12m: 0, custoTotal: 0 },
      sinal: sinalDe(a, resumo, regras.faixas, hoje),
      faixas: regras.faixas,
      antecedenciaPadrao: regras.antecedenciaPadrao,
      faltas: faltasNoCadastro(a),
      idadeAnos: idadeEmAnos(a.compra_data, hoje),
      diasParado12m: diasParado(situacoes, umAnoAntes(hoje), hoje, agora),
      mtbfDias: tempoMedioEntreFalhasDias(corretivas.map((c) => c.criado_em)),
      mttrMin: tempoMedioDeReparoMin(corretivas),
      ordens,
      custoMensal,
      planos,
      anexos: listaAnexos,
      foto,
      verCustos,
      avisoGarantiaDias: regras.avisoGarantiaDias,
      saidas,
      listasDeSaida: listas,
      enderecoDaFicha: urlDoSistema(rotaAtivo(a.id)),
      opcoesDoPlano: {
        setores: listaSetores
          .filter((s) => s.ativo)
          .map((s) => ({ id: s.id, nome: s.nome })),
        categorias: ativas
          .map((c) => ({
            id: c.id,
            nome: `${nomeSetor.get(c.setor_id) ?? ""} › ${c.nome}`,
            setorId: c.setor_id,
            preventiva: c.preventiva,
          }))
          .sort((x, y) => Number(y.preventiva) - Number(x.preventiva)),
        pessoas: listaPessoas.map((p) => ({ id: p.id, nome: p.nome })),
      },
      padraoDoPlano: {
        setorId: setorPadrao,
        categoriaId: categoriaPadrao,
        responsavelId: a.responsavel_id ?? "",
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Cadastro
// ---------------------------------------------------------------------------

type AtualDoCadastro = Pick<Ativo, "loja_id" | "fornecedor_id"> | null;

/**
 * Listas do formulário do ativo (categoria, loja, fornecedor, setor,
 * pessoa). Contrato encerrado só aparece se já é o do ativo.
 */
async function opcoesDoCadastro(
  tx: Tx,
  atual: AtualDoCadastro,
): Promise<OpcoesDoCadastro> {
  const cats = await repo.categoriasDeAtivo(tx);
  const todasLojas = await lojasDoModulo(tx);
  const todasEmpresas = await repo.empresas(tx);
  const listaSetores = await base.setores(tx);
  const quem = await pessoasDoModulo(tx);
  const blocos = await repo.blocosUsados(tx);
  return {
    categorias: cats.map((c) => ({
      id: c.id,
      nome: c.nome,
      vidaUtil: c.vida_util_padrao_anos,
    })),
    lojas: todasLojas
      .filter((l) => l.situacao === "vigente" || l.id === atual?.loja_id)
      .map((l) => ({ id: l.id, nome: `${l.luc} · ${l.nome}`, bloco: l.bloco })),
    empresas: todasEmpresas
      .filter((e) => e.ativo || e.id === atual?.fornecedor_id)
      .map((e) => ({ id: e.id, nome: e.nome })),
    setores: listaSetores
      .filter((s) => s.ativo)
      .map((s) => ({ id: s.id, nome: s.nome })),
    pessoas: quem.map((p) => ({ id: p.id, nome: p.nome })),
    blocos: [
      ...new Set([
        ...blocos,
        ...todasLojas
          .map((l) => l.bloco?.trim())
          .filter((b): b is string => !!b),
      ]),
    ].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true })),
  };
}

/** GET /os/ativos/opcoes: listas do formulário de novo ativo. */
export function lerOpcoesDoCadastro(ctx: Contexto): Promise<OpcoesDoCadastro> {
  exigirGerente(ctx);
  return banco.comoUsuario(ctx.usuario.id, (tx) => opcoesDoCadastro(tx, null));
}

/** GET /os/ativos/:id/edicao: o ativo e as listas do formulário. */
export function ativoParaEditar(
  ctx: Contexto,
  id: string,
): Promise<{ ativo: Ativo; opcoes: OpcoesDoCadastro }> {
  exigirGerente(ctx);
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const a = await repo.ativo(tx, id);
    if (!a) throw new ErroNaoEncontrado("Ativo não encontrado.");
    return {
      ativo: comReais(a, pode(ctx, "os.custos")),
      opcoes: await opcoesDoCadastro(tx, a),
    };
  });
}

// Foto: só o que o navegador mostra (HEIC não abre no Chrome; o celular já
// converte para JPEG ao fotografar pelo campo).
const TIPOS_FOTO = /^image\/(jpeg|png|webp)$/;
// Arquivos: imagem, PDF e Office (o mesmo "accept" do campo). Nada de HTML
// ou script no disco servido por link assinado.
const TIPOS_ARQUIVO = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
export const LIMITE_ARQUIVO = 4 * 1024 * 1024;

/**
 * Anexo do ativo: a linha passa pelo RLS antes de o arquivo ir para o
 * disco; se o arquivo não for, a linha sai junto. Devolve o erro (texto)
 * ou null.
 */
async function guardarAnexo(
  ctx: Contexto,
  ativoId: string,
  categoria: string,
  arquivo: ArquivoRecebido,
): Promise<string | null> {
  const path = caminhoDoArquivo("ativos", ativoId, arquivo.nome);
  let semArquivo = false;
  try {
    await banco.comoUsuario(ctx.usuario.id, async (tx) => {
      await repo.inserirAnexoDoAtivo(tx, {
        ativoId,
        categoria,
        nome: arquivo.nome.slice(0, 200),
        path,
        mime: arquivo.tipo || null,
        tamanho: arquivo.bytes.length,
        usuario: ctx.usuario,
      });
      try {
        await enviarArquivo(
          path,
          arquivo.bytes,
          arquivo.tipo || "application/octet-stream",
        );
      } catch (err) {
        semArquivo = true;
        log.error({ err, ativoId }, "anexo do ativo");
        throw err;
      }
    });
    return null;
  } catch (err) {
    if (semArquivo) return "Não foi possível enviar o arquivo. Tente de novo.";
    if (err instanceof ErroDaApi) return err.message;
    throw err;
  }
}

/**
 * POST /os/ativos (multipart): novo ou edição. O cadastro é gravado antes:
 * se a foto falhar, segue para a ficha com o aviso (voltar ao formulário
 * de novo ativo criaria outro igual).
 */
export async function salvarAtivo(
  ctx: Contexto,
  campos: Record<string, string | string[]>,
  foto: ArquivoRecebido | undefined,
): Promise<{ id: string; semFoto: boolean }> {
  exigirGerente(ctx);
  const c = { ...campos };
  // Sem os.custos, os valores em reais nem aparecem no formulário: não mexe.
  if (!pode(ctx, "os.custos")) {
    delete c.compra_valor;
    delete c.valor_reposicao;
  }
  const d: EntradaAtivo = validar(entradaAtivo, c, ROTULOS_ATIVO);
  if (
    foto &&
    (!TIPOS_FOTO.test(foto.tipo) || foto.bytes.length > LIMITE_ARQUIVO)
  )
    throw new ErroDeNegocio("Foto: envie uma imagem de até 4 MB.");

  const { id: atual, ...valores } = d;
  const salvo = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    atual
      ? repo.atualizarAtivo(tx, atual, valores)
      : repo.inserirAtivo(tx, valores),
  );
  if (!salvo) throw new ErroDeNegocio("Ativo não encontrado.");
  const semFoto = foto
    ? !!(await guardarAnexo(ctx, salvo, "foto", foto))
    : false;
  return { id: salvo, semFoto };
}

/** Em uso, Em manutenção ou Parado (Parado e Em manutenção contam como dias parado). */
export async function mudarSituacao(
  ctx: Contexto,
  id: string,
  situacao: "em_uso" | "em_manutencao" | "parado",
): Promise<string> {
  exigirGerente(ctx);
  const ok = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.atualizarAtivo(tx, id, {
      situacao,
      baixa_data: null,
      baixa_motivo: null,
    }),
  );
  if (!ok) throw new ErroDeNegocio("Ativo não encontrado.");
  return "Situação atualizada.";
}

/** Dar baixa: sai de uso com data e motivo; os planos preventivos param. */
export async function darBaixa(
  ctx: Contexto,
  id: string,
  d: { baixa_data: string; baixa_motivo: string },
): Promise<string> {
  exigirGerente(ctx);
  if (d.baixa_data > hojeEmBrasilia(new Date()))
    throw new ErroDeNegocio("Data da baixa: não pode ser no futuro.");
  await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const ok = await repo.atualizarAtivo(tx, id, {
      situacao: "baixado",
      baixa_data: d.baixa_data,
      baixa_motivo: d.baixa_motivo,
    });
    if (!ok) throw new ErroDeNegocio("Ativo não encontrado.");
    await repo.pausarPlanosDoAtivo(tx, id);
  });
  return "Baixa registrada. Os planos preventivos foram pausados.";
}

export async function enviarAnexo(
  ctx: Contexto,
  ativoId: string,
  categoria: string,
  arquivo: ArquivoRecebido | undefined,
): Promise<string> {
  exigirGerente(ctx);
  if (!arquivo) throw new ErroDeNegocio("Arquivo: escolha um arquivo.");
  if (arquivo.bytes.length > LIMITE_ARQUIVO)
    throw new ErroDeNegocio("Arquivo: até 4 MB por arquivo.");
  if (categoria === "foto" && !TIPOS_FOTO.test(arquivo.tipo))
    throw new ErroDeNegocio("Foto: envie uma imagem (JPG, PNG ou WebP).");
  if (!TIPOS_FOTO.test(arquivo.tipo) && !TIPOS_ARQUIVO.has(arquivo.tipo))
    throw new ErroDeNegocio("Arquivo: envie imagem, PDF, Word ou Excel.");
  const erro = await guardarAnexo(ctx, ativoId, categoria, arquivo);
  if (erro) throw new ErroDeNegocio(erro);
  return "Arquivo anexado.";
}

export async function removerAnexo(ctx: Contexto, id: string): Promise<string> {
  exigirGerente(ctx);
  const removidos = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.removerAnexoDoAtivo(tx, id),
  );
  await removerArquivos(removidos.map((a) => a.path));
  return "Anexo removido.";
}

// ---------------------------------------------------------------------------
// Planos preventivos
// ---------------------------------------------------------------------------

export async function salvarPlano(
  ctx: Contexto,
  d: EntradaPlano,
): Promise<string> {
  exigirGerente(ctx);
  const { id: atual, unidade, frequencia, checklist, ...resto } = d;
  await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    // A OS nasce no setor do plano: a categoria precisa ser desse setor.
    if (resto.categoria_id) {
      const cat = await base.categoria(tx, resto.categoria_id);
      if (!cat) throw new ErroDeNegocio("Categoria da OS: não encontrada.");
      if (cat.setor_id !== resto.setor_id)
        throw new ErroDeNegocio(
          "Categoria da OS: escolha uma categoria do setor.",
        );
    }
    await repo.salvarPlano(tx, atual ?? null, {
      ...resto,
      frequencia_dias: unidade === "dias" ? frequencia : null,
      frequencia_meses: unidade === "meses" ? frequencia : null,
      checklist: lerChecklist(checklist),
    });
  });
  return atual ? "Plano salvo." : "Plano criado.";
}

export async function alternarPlano(
  ctx: Contexto,
  id: string,
  ativo: boolean,
): Promise<string> {
  exigirGerente(ctx);
  await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.alternarPlano(tx, id, ativo),
  );
  return ativo ? "Plano retomado." : "Plano pausado.";
}

export async function excluirPlano(ctx: Contexto, id: string): Promise<string> {
  exigirGerente(ctx);
  await banco.comoUsuario(ctx.usuario.id, (tx) => repo.excluirPlano(tx, id));
  return "Plano excluído. As OS já criadas continuam.";
}

/**
 * "Gerar agora": cria a OS da próxima data sem esperar a antecedência e
 * avança o plano. A criação é a mesma da rotina (service role), depois de
 * conferir a permissão e ler o plano pela sessão.
 */
export async function gerarPreventivaAgora(
  ctx: Contexto,
  id: string,
): Promise<string> {
  exigirGerente(ctx);
  const { p, ativo, expedienteFim } = await banco.comoUsuario(
    ctx.usuario.id,
    async (tx) => {
      const p = await repo.plano(tx, id);
      if (!p) throw new ErroDeNegocio("Plano não encontrado.");
      const ativo = await repo.ativo(tx, p.ativo_id);
      if (!ativo) throw new ErroDeNegocio("Ativo não encontrado.");
      if (ativo.situacao === "baixado")
        throw new ErroDeNegocio("Ativo baixado não recebe preventiva.");
      return {
        p,
        ativo,
        expedienteFim: (await base.parametros(tx)).expediente_fim,
      };
    },
  );
  await exigir(ctx, "os.ativos_gerenciar");
  let criado: Awaited<ReturnType<typeof criarPreventiva>>;
  try {
    criado = await banco.comoServico((tx) =>
      criarPreventiva(tx, p, ativo, p.proxima_data, {
        expedienteFim,
        abertoPor: ctx.usuario.id,
        autorNome: ctx.usuario.nome,
      }),
    );
  } catch (err) {
    log.error({ err, plano: p.id }, "gerar preventiva");
    throw new ErroDeNegocio("Não foi possível criar a OS. Tente de novo.");
  }
  await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.avancarPlano(
      tx,
      p.id,
      p.proxima_data,
      proximaDataDoPlano(p, p.proxima_data),
    ),
  );
  return criado
    ? `OS #${criado.numero} criada. O plano seguiu para a próxima data.`
    : `A OS de ${formatarData(p.proxima_data)} já existia. O plano seguiu para a próxima data.`;
}

// ---------------------------------------------------------------------------
// Categorias de ativo
// ---------------------------------------------------------------------------

/** GET /os/ativos/categorias: as categorias e quantos ativos cada uma tem. */
export function lerCategorias(ctx: Contexto) {
  exigirGerente(ctx);
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const cats = await repo.categoriasDeAtivo(tx);
    const contagem = new Map(
      (await repo.ativosPorCategoria(tx)).flatMap((c) =>
        c.categoria_id ? [[c.categoria_id, Number(c.total)]] : [],
      ),
    );
    return {
      categorias: cats.map((c) => ({ ...c, ativos: contagem.get(c.id) ?? 0 })),
    };
  });
}

export async function salvarCategoria(
  ctx: Contexto,
  d: EntradaCategoriaAtivo,
): Promise<string> {
  exigirGerente(ctx);
  const { id: atual, ...valores } = d;
  await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.salvarCategoriaDeAtivo(tx, atual ?? null, valores),
  );
  return atual ? "Categoria salva." : "Categoria criada.";
}

export async function excluirCategoria(
  ctx: Contexto,
  id: string,
): Promise<string> {
  exigirGerente(ctx);
  await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.excluirCategoriaDeAtivo(tx, id),
  );
  return "Categoria excluída. Os ativos dela ficaram sem categoria.";
}

// ---------------------------------------------------------------------------
// Etiquetas
// ---------------------------------------------------------------------------

async function ativosParaEtiqueta(tx: Tx) {
  return (await repo.ativosParaEtiqueta(tx)).map((a) => ({
    id: a.id,
    codigo: a.codigo,
    nome: a.nome,
    situacao: a.situacao,
    local: descreverLocal({
      ...a,
      loja: a.luc ? `${a.luc} ${a.loja_nome}` : null,
    }),
  }));
}

/** GET /os/ativos/etiquetas: os ativos para marcar e a grade da folha. */
export function lerEtiquetas(ctx: Contexto) {
  exigirGerente(ctx);
  return banco.comoUsuario(ctx.usuario.id, async (tx) => ({
    ativos: (await ativosParaEtiqueta(tx)).map((a) => ({
      id: a.id,
      codigo: a.codigo,
      nome: a.nome,
      local: a.local,
      baixado: a.situacao === "baixado",
    })),
    porFolha: POR_FOLHA,
    grade: GRADE,
  }));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** PDF das etiquetas QR (lido pela sessão; o RLS confere). */
export async function pdfDeEtiquetas(
  ctx: Contexto,
  ids: string[],
  inicioPedido: unknown,
): Promise<{ bytes: Uint8Array; nome: string }> {
  if (!pode(ctx, "os.ativos_gerenciar"))
    throw new ErroDePermissao(
      "Você não tem permissão para imprimir etiquetas.",
    );
  if (ids.length > 2000)
    throw new ErroDeValidacao("Até 2000 etiquetas por vez.");
  if (!ids.length || !ids.every((i) => UUID.test(i)))
    throw new ErroDeValidacao("Escolha pelo menos um ativo.");
  const n = Number(inicioPedido ?? 1);
  const inicio = Number.isInteger(n) && n >= 1 && n <= POR_FOLHA ? n : 1;
  const pedidos = new Set(ids);
  const ativos = (
    await banco.comoUsuario(ctx.usuario.id, ativosParaEtiqueta)
  ).filter((a) => pedidos.has(a.id));
  const bytes = await gerarEtiquetas(
    ativos.map((a) => ({
      codigo: a.codigo,
      nome: a.nome,
      local: a.local,
      url: urlDoSistema(rotaAtivo(a.id)),
    })),
    inicio,
  );
  // O código é editável (e vem da importação): no nome, só ASCII seguro.
  const nome =
    ativos.length === 1
      ? `etiqueta-${(ativos[0]?.codigo ?? "").replace(/[^A-Za-z0-9._-]+/g, "-")}`
      : "etiquetas-ativos";
  return { bytes, nome: `${nome}.pdf` };
}
