import { formatarDataHora } from "@arp/shared/formato";
import {
  datasDoPlano,
  finalizado,
  type ItemCalendario,
  intervaloDaVisao,
  periodoEscolhido,
  rotuloPeriodo,
} from "@arp/shared/os/calendario";
import { andamentoDosDestinos } from "@arp/shared/os/ciclo";
import type {
  Planilha,
  RespostaCalendario,
  RespostaLista,
  RespostaQuadro,
  RespostaSeuDia,
} from "@arp/shared/os/contratos/visoes";
import type { CelulaExportar, ColunaExportar } from "@arp/shared/os/exportar";
import {
  agrupar,
  type Busca,
  CARTOES_DA_TELA,
  type Carga,
  type ChaveCartao,
  COLUNAS_DA_TELA,
  type ContextoLista,
  cargaDasContagens,
  criterioDoCartao,
  type Filtros,
  type LinhaChamado,
  lerBusca,
  lerCartao,
  lerFiltros,
  lerOrdem,
  type ModoGrupo,
  modoDaLista,
  type Ordem,
  ordemDaConsulta,
  ordemPadraoDa,
  type PassoOrdem,
  PREFERENCIA_FILTROS,
  PREFERENCIA_SEU_DIA,
  paraExportar,
  type Recorte,
  statusDoFiltro,
  TELA_BASE,
  type Tela,
  type TelaComLista,
  type TelaLista,
  TIPOS_SEM_AVISO,
  temFiltrosNaUrl,
} from "@arp/shared/os/lista";
import { formatarNumeroOS, numeroDo } from "@arp/shared/os/numeros";
import { paginaDaUrl } from "@arp/shared/os/paginacao";
import {
  COLUNAS_QUADRO,
  type ColunaDoQuadro,
  lerMais,
  limiteDaColuna,
  type MaisPorColuna,
} from "@arp/shared/os/quadro";
import { rotaAtivo } from "@arp/shared/os/rotas";
import {
  PRIORIDADES,
  STATUS,
  type StatusChamado,
} from "@arp/shared/os/rotulos";
import {
  deBrasilia,
  hojeEmBrasilia,
  instante,
  paraBrasilia,
  somarDias,
} from "@arp/shared/os/tempo";
import type { Contexto } from "@/contexto";
import { ErroDePermissao } from "@/erros";
import { banco, type Tx } from "@/infra/banco";
import type { JsonValue } from "@/infra/banco/tipos";
import { agendamentosDoPeriodo } from "./agenda.repository";
import {
  type Apoio,
  apoio,
  buscarChamados,
  buscarPaginaDeChamados,
  type ChamadoResumo,
  cargaPorResponsavel,
  contarChamados,
  type FiltroChamados,
  gerencia,
  type Setor,
  todosOsChamados,
} from "./base.service";
import { origemDaTela } from "./chamado-detalhe.service";
import { destinosDosChamados } from "./chamados.repository";
import {
  type LeitorDoAviso,
  leitoresDosAvisos,
  lidosPorMim,
} from "./leituras.repository";
import { preferenciasDoModulo } from "./preferencias.repository";
import * as repo from "./visoes.repository";

// Dados das visões do dia a dia (Minha caixa, Geral, Avisos, Quadro e
// Calendário). Tudo pela sessão (RLS), um escopo por pedido. As listas e o
// quadro pedem ao banco só a página (ou os primeiros cartões de cada coluna)
// com o total junto; cartões e carga por pessoa são contagens. As telas das
// OS (os_caixa, os_setor, os_quadro) são as mesmas, lendo os.ordens.

export { gerencia } from "./base.service";

/** Setores que a pessoa pode escolher (os dela, ou todos com permissão). */
export function setoresDisponiveis(a: Apoio): Setor[] {
  return a.cx.pode("os.todos_setores")
    ? a.setores.filter((s) => s.ativo)
    : a.setores.filter((s) => a.cx.setores.includes(s.id));
}

/** Pessoas de cada setor (para atribuir responsável em 1 clique). */
export function pessoasPorSetor(
  a: Apoio,
  setorIds: Iterable<string>,
): Record<string, { id: string; nome: string }[]> {
  const r: Record<string, { id: string; nome: string }[]> = {};
  for (const id of new Set(setorIds))
    r[id] = a.pessoas
      .filter((p) => p.setores.includes(id))
      .map((p) => ({ id: p.id, nome: p.nome }));
  return r;
}

/** Chamado do banco → linha da tela, com o que a pessoa pode mudar. */
export function paraLinha(
  ch: ChamadoResumo,
  a: Apoio,
  soNoCartao = false,
): LinhaChamado {
  const eu = a.cx.usuario.id;
  const setor = a.setorPorId.get(ch.setor_id);
  const pediu = ch.aberto_por === eu;
  const gestor = gerencia(a.cx, ch.setor_id);
  const aberto = !["concluido", "fechado", "cancelado"].includes(ch.status);
  return {
    id: ch.id,
    numero: ch.numero,
    tipo: ch.tipo,
    origem: origemDaTela(ch.origem),
    titulo: ch.titulo,
    status: ch.status,
    prioridade: ch.prioridade,
    prazo: ch.prazo,
    setorId: ch.setor_id,
    setor: setor?.nome ?? "Setor",
    setorCor: setor?.cor ?? "#a3a3a3",
    categoriaId: ch.categoria_id,
    categoria: ch.categoria_id
      ? (a.categoriaPorId.get(ch.categoria_id)?.nome ?? null)
      : null,
    responsavelId: ch.responsavel_id,
    responsavel: ch.responsavel_id
      ? (a.nomes.get(ch.responsavel_id) ?? "Usuário inativo")
      : null,
    abertoPor: ch.aberto_por,
    solicitante: ch.aberto_por
      ? (a.nomes.get(ch.aberto_por) ?? "Usuário inativo")
      : ch.solicitante_nome,
    etiquetas: ch.etiquetas,
    aguardando: ch.aguardando_tipo,
    pessoal: ch.pessoal,
    precisaConfirmacao: ch.precisa_confirmacao,
    concluidoEm: ch.concluido_em,
    fechadoEm: ch.fechado_em,
    criadoEm: ch.criado_em,
    soNoCartao,
    // As mesmas regras do gatilho os.validar_chamado (o banco confere).
    podeAtribuir: aberto && (gestor || (pediu && ch.status === "aberto")),
    podePrazo: aberto && (gestor || pediu),
  };
}

// ---------------------------------------------------------------------------
// Filtros: da URL ou os lembrados
// ---------------------------------------------------------------------------

export interface FiltrosDaTela {
  filtros: Filtros;
  /** Vieram da preferência (a URL não tinha filtros). */
  lembrados: boolean;
}

const objeto = (v: JsonValue | undefined) =>
  v && typeof v === "object" && !Array.isArray(v) ? v : null;

/**
 * Filtros da tela: os da URL; sem nenhum na URL, os lembrados (a mesma
 * leitura das preferências serve ao "Seu dia").
 */
export async function filtrosDaTela(
  tx: Tx,
  tela: Tela,
  busca: Busca,
): Promise<FiltrosDaTela> {
  if (temFiltrosNaUrl(tela, busca))
    return { filtros: lerFiltros(tela, busca), lembrados: false };
  const guardado = (await preferenciasDoModulo(tx)).get(
    PREFERENCIA_FILTROS[tela],
  );
  const filtros = lerFiltros(tela, objeto(guardado));
  return { filtros, lembrados: Object.keys(filtros).length > 0 };
}

/**
 * Filtros da barra → consulta padrão (base). Os avisos têm aba própria:
 * "tickets" os tira (mesmo de um filtro lembrado), "avisos" só os traz e
 * "tudo" (o Calendário) não separa.
 */
export function paraConsulta(
  f: Filtros,
  recorte: Recorte,
  escopo: "tickets" | "avisos" | "tudo" = "tudo",
): FiltroChamados {
  const tipos =
    escopo === "avisos"
      ? (["aviso"] as const)
      : escopo === "tudo"
        ? f.tipo && [f.tipo]
        : f.tipo && f.tipo !== "aviso"
          ? [f.tipo]
          : TIPOS_SEM_AVISO;
  return {
    recorte,
    setor: f.setor ?? null,
    tipos: tipos ? [...tipos] : undefined,
    status: statusDoFiltro(f.status),
    categoria: f.categoria ?? null,
    responsavel: f.responsavel ?? null,
    prioridade: f.prioridade ?? null,
    etiqueta: f.etiqueta ?? null,
    de: f.de ?? null,
    ate: f.ate ?? null,
  };
}

/** Filtros → o que a tela recebe (só o que tem valor, como texto). */
function paraResposta(f: Filtros): Record<string, string> {
  const r: Record<string, string> = {};
  for (const [k, v] of Object.entries(f)) if (v) r[k] = String(v);
  return r;
}

// ---------------------------------------------------------------------------
// Listas paginadas (Minha caixa, Geral, Avisos): o banco devolve só a
// página, conta os cartões e a carga; tudo com os mesmos filtros da barra.
// A exportação lê o resultado inteiro no clique.
// ---------------------------------------------------------------------------

const RECORTE_DA_TELA: Record<TelaLista, Recorte> = {
  caixa: "minha_caixa",
  setor: "meu_setor",
  abertos: "abertos_por_mim",
  avisos: "minha_caixa",
  avisos_mandados: "abertos_por_mim",
};

const umTexto = (v: unknown): string | undefined =>
  typeof v === "string"
    ? v
    : Array.isArray(v) && typeof v[0] === "string"
      ? v[0]
      : undefined;

export interface EstadoDaLista {
  tela: TelaLista;
  /** Lista das OS (aba de Ordens de serviço) em vez dos chamados. */
  ordens: boolean;
  a: Apoio;
  filtros: Filtros;
  lembrados: boolean;
  /** Barra e recorte (sem o cartão nem a busca). */
  consulta: FiltroChamados;
  cartao: ChaveCartao | null;
  q: string;
  ordem: Ordem | null;
  modo: ModoGrupo;
  pagina: number;
  /** Geral: setores que a pessoa pode escolher (vazio: nenhum). */
  disponiveis: Setor[];
  /** Geral: os setores em vigor (sem escolha: todos os disponíveis). */
  setores: string[];
}

/**
 * Tudo o que a lista lê da URL (ou dos filtros lembrados). "Abertos por mim"
 * é filtro: na Minha caixa troca a lista (cartões, colunas e o andamento dos
 * avisos de "abertos"); no Geral só restringe.
 */
export async function estadoDaLista(
  tx: Tx,
  ctx: Contexto,
  tela: TelaComLista,
  busca: Busca,
): Promise<EstadoDaLista> {
  const a = await apoio(tx, ctx);
  const lidos = await filtrosDaTela(tx, tela, busca);
  let filtros = lidos.filtros;
  const porMim = filtros.aberto_por === "eu";
  // As telas da OS são as mesmas listas, lendo os.ordens.
  const ordens = tela === "os_caixa" || tela === "os_setor";
  const base =
    tela === "os_caixa" || tela === "os_setor" ? TELA_BASE[tela] : tela;
  // Avisos: os que recebi (como a Minha caixa) e, em Mostrar, os que mandei.
  const lista: TelaLista =
    base === "setor"
      ? "setor"
      : base === "avisos"
        ? porMim
          ? "avisos_mandados"
          : "avisos"
        : porMim
          ? "abertos"
          : "caixa";
  // O status só aparece na barra dos abertos por mim (aviso não tem).
  if (lista !== "abertos" && lista !== "setor")
    filtros = { ...filtros, status: undefined };
  let disponiveis: Setor[] = [];
  let setores: string[] = [];
  if (base === "setor") {
    // Setores escolhidos (lembrados) que a pessoa ainda pode ver; sem
    // escolha válida, ou com todos marcados, valem todos os disponíveis.
    disponiveis = setoresDisponiveis(a);
    const pedidos = new Set(filtros.setores?.split(","));
    const escolhidos = disponiveis
      .filter((s) => pedidos.has(s.id))
      .map((s) => s.id);
    const todos =
      !escolhidos.length || escolhidos.length === disponiveis.length;
    setores = todos ? disponiveis.map((s) => s.id) : escolhidos;
    filtros = {
      ...filtros,
      setores: todos ? undefined : escolhidos.join(","),
    };
  }
  const ordem = lerOrdem(busca.ordem);
  return {
    tela: lista,
    ordens,
    a,
    filtros,
    lembrados: lidos.lembrados,
    consulta: {
      ...paraConsulta(
        filtros,
        RECORTE_DA_TELA[lista],
        tela === "avisos" ? "avisos" : "tickets",
      ),
      ordens,
      setores: setores.length ? setores : null,
      abertoPor: porMim ? a.cx.usuario.id : null,
      comConfirmacao: lista === "caixa",
    },
    cartao: lerCartao(lista, busca.cartao),
    q: lerBusca(busca.q),
    ordem,
    modo: modoDaLista(lista, filtros.agrupar, ordem),
    pagina: paginaDaUrl(umTexto(busca.pagina)),
    disponiveis,
    setores,
  };
}

const contextoDaLista = (a: Apoio): ContextoLista => ({
  agora: a.agora,
  eu: a.cx.usuario.id,
  avisoHoras: a.avisoHoras,
});

/** Consulta da lista com um cartão (o clicado, por padrão) e a busca. */
export function consultaDaLista(
  e: EstadoDaLista,
  cartao: ChaveCartao | null = e.cartao,
  comBusca = true,
): FiltroChamados {
  return {
    ...e.consulta,
    cartao: cartao ? criterioDoCartao(cartao, contextoDaLista(e.a)) : null,
    busca: comBusca ? e.q : null,
  };
}

/** Chamados → linhas da tela (avisos com vários destinos: o andamento). */
async function paraLinhasDaLista(
  tx: Tx,
  e: EstadoDaLista,
  chamados: ChamadoResumo[],
): Promise<LinhaChamado[]> {
  const ids = chamados.map((c) => c.id);
  if (e.tela === "avisos") {
    const lidos = await lidosPorMim(tx, ids, e.a.cx.usuario.id);
    return chamados.map((c) => ({
      ...paraLinha(c, e.a),
      lido: lidos.has(c.id),
    }));
  }
  if (e.tela === "avisos_mandados") {
    const leitores = await leitoresDosAvisos(tx, ids);
    return chamados.map((c) => ({
      ...paraLinha(c, e.a),
      destinos: leituraDoAviso(leitores.get(c.id) ?? [], e.a),
    }));
  }
  const destinos =
    e.tela === "abertos" && !e.ordens
      ? await andamentoDosAvisos(
          tx,
          chamados.filter((c) => c.tipo === "aviso").map((c) => c.id),
          e.a,
        )
      : null;
  return chamados.map((c) => ({
    ...paraLinha(c, e.a),
    destinos: destinos?.get(c.id) ?? null,
  }));
}

/** Só a página mostrada, na ordem do grupo e da coluna escolhida. */
export async function paginaDaLista(
  tx: Tx,
  e: EstadoDaLista,
): Promise<{ linhas: LinhaChamado[]; total: number; pagina: number }> {
  const r = await buscarPaginaDeChamados(tx, e.a.cx, consultaDaLista(e), {
    pagina: e.pagina,
    ordem: ordemDaConsulta(e.modo, e.ordem, ordemPadraoDa(e.tela)),
  });
  return { ...r, linhas: await paraLinhasDaLista(tx, e, r.linhas) };
}

/**
 * Número de cada cartão, contado no banco com os filtros da barra (a busca
 * não muda os cartões).
 */
export async function contarCartoes(
  tx: Tx,
  e: EstadoDaLista,
): Promise<Record<string, number>> {
  const valores: Record<string, number> = {};
  for (const c of CARTOES_DA_TELA[e.tela])
    valores[c] = await contarChamados(tx, e.a.cx, consultaDaLista(e, c, false));
  return valores;
}

/**
 * Carga por pessoa do Geral: abertos e atrasados de cada pessoa dos
 * setores e da fila, com os filtros da barra, contados no banco (uma linha
 * por responsável); os atrasados são os abertos com prazo antes de agora,
 * como o cartão. Filtrando por um responsável, os outros ficam com zero
 * (como a lista).
 */
export async function cargaDoSetor(
  tx: Tx,
  e: EstadoDaLista,
  membros: { id: string; nome: string }[],
): Promise<Carga[]> {
  const contagens = await cargaPorResponsavel(
    tx,
    consultaDaLista(e, null, false),
    e.a.agora,
  );
  return cargaDasContagens(contagens, membros);
}

/** GET /os/visoes/lista */
export function lerLista(
  ctx: Contexto,
  tela: TelaComLista,
  busca: Busca,
): Promise<RespostaLista> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const e = await estadoDaLista(tx, ctx, tela, busca);
    const { a, setores } = e;
    const geral = e.tela === "setor";
    const comum = {
      tela: e.tela,
      filtros: paraResposta(e.filtros),
      lembrados: e.lembrados,
      disponiveis: e.disponiveis.map((s) => s.id),
      setores,
      agora: a.agora.toISOString(),
    };
    // Geral sem setor nenhum: a tela só avisa.
    if (geral && !setores.length)
      return {
        ...comum,
        linhas: [],
        total: 0,
        pagina: 1,
        cartoes: {},
        carga: null,
      };
    const pagina = await paginaDaLista(tx, e);
    const cartoes = await contarCartoes(tx, e);
    let carga: Carga[] | null = null;
    if (geral) {
      const pessoas = pessoasPorSetor(a, setores);
      // Quem está em mais de um setor aparece uma vez.
      const membros = [
        ...new Map(
          setores.flatMap((s) => pessoas[s] ?? []).map((p) => [p.id, p]),
        ).values(),
      ].sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
      carga = await cargaDoSetor(tx, e, membros);
    }
    return { ...comum, ...pagina, cartoes, carga };
  });
}

/** Só quem usa o módulo e pode exportar. */
function exigirExportar(ctx: Contexto): void {
  if (!ctx.permissoes.has("os.acessar") || !ctx.permissoes.has("os.exportar"))
    throw new ErroDePermissao("Sem permissão para exportar.");
}

/**
 * GET /os/visoes/lista/exportacao: o resultado filtrado inteiro (os mesmos
 * filtros da tela: a URL, ou os lembrados), agrupado como na tela.
 */
export function exportarLista(
  ctx: Contexto,
  tela: TelaComLista,
  busca: Busca,
): Promise<Planilha> {
  exigirExportar(ctx);
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const e = await estadoDaLista(tx, ctx, tela, busca);
    const chamados = await todosOsChamados(
      tx,
      e.a.cx,
      consultaDaLista(e),
      ordemDaConsulta(e.modo, e.ordem, ordemPadraoDa(e.tela)),
    );
    const linhas = await paraLinhasDaLista(tx, e, chamados);
    const c = contextoDaLista(e.a);
    return paraExportar(
      agrupar(linhas, e.modo, c),
      e.modo,
      COLUNAS_DA_TELA[e.tela],
      c,
    );
  });
}

// ---------------------------------------------------------------------------
// Quadro: uma consulta por coluna (os primeiros cartões e o total real)
// ---------------------------------------------------------------------------

export interface EstadoDoQuadro {
  /** Quadro das OS (aba de Ordens de serviço) em vez dos chamados. */
  ordens: boolean;
  a: Apoio;
  filtros: Filtros;
  lembrados: boolean;
  /** Filtros em vigor (recorte permitido, setor só onde cabe). */
  valores: Filtros;
  permitidos: Recorte[];
  comSetor: boolean;
  setores: Setor[];
  consulta: FiltroChamados;
  mais: MaisPorColuna;
}

/** Recortes que a pessoa pode escolher no quadro e no calendário. */
function recortesPermitidos(a: Apoio): Recorte[] {
  return [
    "minha_caixa",
    ...(a.cx.pode("os.meu_setor") ? (["meu_setor"] as const) : []),
    "abertos_por_mim",
    ...(a.cx.pode("os.todos_setores") ? (["todos"] as const) : []),
  ];
}

export async function estadoDoQuadro(
  tx: Tx,
  ctx: Contexto,
  busca: Busca,
  ordens = false,
): Promise<EstadoDoQuadro> {
  const a = await apoio(tx, ctx);
  const { filtros, lembrados } = await filtrosDaTela(
    tx,
    ordens ? "os_quadro" : "quadro",
    busca,
  );
  const permitidos = recortesPermitidos(a);
  const recorte =
    filtros.recorte && permitidos.includes(filtros.recorte)
      ? filtros.recorte
      : "minha_caixa";
  const comSetor = recorte === "meu_setor" || recorte === "todos";
  const valores: Filtros = {
    ...filtros,
    recorte,
    setor: comSetor ? filtros.setor : undefined,
  };
  return {
    ordens,
    a,
    filtros,
    lembrados,
    valores,
    permitidos,
    comSetor,
    setores:
      recorte === "todos"
        ? a.setores.filter((s) => s.ativo)
        : setoresDisponiveis(a),
    consulta: {
      ...paraConsulta({ ...valores, status: undefined }, recorte, "tickets"),
      ordens,
    },
    mais: lerMais(busca.mais),
  };
}

/** Colunas que o quadro consulta (Fechado só com o filtro "Fechados"). */
export const colunasConsultadas = (e: EstadoDoQuadro): StatusChamado[] =>
  COLUNAS_QUADRO.filter((s) => s !== "fechado" || !!e.filtros.fechados);

/** Mais novos em cima; em Fechado, os fechados mais recentes. */
const ordemDaColuna = (s: StatusChamado): PassoOrdem[] => [
  {
    coluna: s === "fechado" ? "fechado_em" : "criado_em",
    asc: false,
    nullsFirst: false,
  },
  { coluna: "numero", asc: false, nullsFirst: false },
];

/** Consulta de uma coluna: o status dela como "cartão" sobre as colunas. */
const consultaDaColuna = (
  e: EstadoDoQuadro,
  status: StatusChamado,
): FiltroChamados => ({
  ...e.consulta,
  status: colunasConsultadas(e),
  cartao: { status: [status] },
});

export async function colunasDoQuadro(
  tx: Tx,
  e: EstadoDoQuadro,
): Promise<ColunaDoQuadro[]> {
  const colunas: {
    status: StatusChamado;
    chamados: ChamadoResumo[];
    total: number;
  }[] = [];
  for (const status of colunasConsultadas(e)) {
    const r = await buscarPaginaDeChamados(
      tx,
      e.a.cx,
      consultaDaColuna(e, status),
      {
        pagina: 1,
        porPagina: limiteDaColuna(e.mais, status),
        ordem: ordemDaColuna(status),
      },
    );
    colunas.push({ status, chamados: r.linhas, total: r.total });
  }
  const numeros = await repo.contagens(
    tx,
    colunas.flatMap((c) => c.chamados.map((x) => x.id)),
    e.ordens,
  );
  return colunas.map((c) => ({
    status: c.status,
    total: c.total,
    cartoes: c.chamados.map((x) => ({
      ...paraLinha(x, e.a),
      contagens: numeros.get(x.id),
    })),
  }));
}

/** GET /os/visoes/quadro */
export function lerQuadro(
  ctx: Contexto,
  busca: Busca,
  ordens: boolean,
): Promise<RespostaQuadro> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const e = await estadoDoQuadro(tx, ctx, busca, ordens);
    return {
      filtros: paraResposta(e.filtros),
      valores: paraResposta(e.valores),
      lembrados: e.lembrados,
      permitidos: e.permitidos,
      comSetor: e.comSetor,
      setores: e.setores.map((s) => s.id),
      // Uma consulta por coluna: os primeiros cartões e o total real dela.
      colunas: await colunasDoQuadro(tx, e),
      agora: e.a.agora.toISOString(),
    };
  });
}

/** GET /os/visoes/quadro/exportacao: todas as colunas consultadas, inteiras. */
export function exportarQuadro(
  ctx: Contexto,
  busca: Busca,
  ordens: boolean,
): Promise<Planilha> {
  exigirExportar(ctx);
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const e = await estadoDoQuadro(tx, ctx, busca, ordens);
    const linhas: CelulaExportar[][] = [];
    for (const s of colunasConsultadas(e)) {
      const chamados = await todosOsChamados(
        tx,
        e.a.cx,
        consultaDaColuna(e, s),
        ordemDaColuna(s),
      );
      for (const x of chamados) {
        const c = paraLinha(x, e.a);
        linhas.push([
          STATUS[s],
          c.numero,
          c.titulo,
          c.categoria ?? "",
          c.responsavel ?? "Na fila",
          PRIORIDADES[c.prioridade],
          c.prazo ? formatarDataHora(c.prazo) : "",
        ]);
      }
    }
    return {
      colunas: [
        { titulo: "Coluna" },
        { titulo: "Número", numero: true },
        { titulo: "Título" },
        { titulo: "Categoria" },
        { titulo: "Responsável" },
        { titulo: "Prioridade" },
        { titulo: "Prazo" },
      ] satisfies ColunaExportar[],
      linhas,
    };
  });
}

// ---------------------------------------------------------------------------
// Andamento dos avisos
// ---------------------------------------------------------------------------

/** Quem mandou o aviso: "3 de 5 leram" e quem ainda não leu. */
function leituraDoAviso(
  leitores: LeitorDoAviso[],
  a: Apoio,
): NonNullable<LinhaChamado["destinos"]> {
  const faltam = leitores.filter((l) => !l.lidoEm);
  return {
    texto: `${leitores.length - faltam.length} de ${leitores.length} leram`,
    todos: !faltam.length,
    faltam: faltam.map((l) => a.nomes.get(l.id) ?? "Pessoa"),
  };
}

/**
 * Avisos para vários setores ou pessoas: "3 de 5 concluídos" e quem falta
 * (o título do item, o setor ou a pessoa).
 */
export async function andamentoDosAvisos(
  tx: Tx,
  ids: string[],
  a: Apoio,
): Promise<Map<string, NonNullable<LinhaChamado["destinos"]>>> {
  const r = new Map<string, NonNullable<LinhaChamado["destinos"]>>();
  if (!ids.length) return r;
  const linhas = await destinosDosChamados(tx, ids);
  const porChamado = new Map<string, typeof linhas>();
  for (const d of linhas)
    if (d.chamado_id)
      porChamado.set(d.chamado_id, [
        ...(porChamado.get(d.chamado_id) ?? []),
        d,
      ]);

  for (const [id, destinos] of porChamado) {
    if (destinos.length < 2) continue;
    const andamento = andamentoDosDestinos(destinos);
    r.set(id, {
      texto: andamento.texto,
      todos: andamento.todosConcluidos,
      faltam: destinos
        .filter((d) => d.status !== "concluido")
        .map(
          (d) =>
            d.titulo ??
            (d.setor_id ? a.setorPorId.get(d.setor_id)?.nome : null) ??
            (d.usuario_id ? a.nomes.get(d.usuario_id) : null) ??
            "Destino",
        ),
    });
  }
  return r;
}

// ---------------------------------------------------------------------------
// "Seu dia": só na primeira entrada do dia
// ---------------------------------------------------------------------------

const DIAS = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
];
const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function saudacao(hora: string): string {
  const h = Number(hora.slice(0, 2));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

/**
 * GET /os/visoes/seu-dia: lê o dia já visto em core.preferencias e, se ainda
 * não foi hoje, conta o que pede atenção em toda a caixa da pessoa (sem os
 * filtros da tela), só contando no banco.
 */
export function seuDia(ctx: Contexto): Promise<RespostaSeuDia> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const a = await apoio(tx, ctx);
    const visto = objeto(
      (await preferenciasDoModulo(tx)).get(PREFERENCIA_SEU_DIA),
    );
    const hoje = hojeEmBrasilia(a.agora);
    if (visto?.dia === hoje) return { resumo: null };

    const c = { agora: a.agora, eu: a.cx.usuario.id };
    const atrasados = await contarChamados(tx, a.cx, {
      recorte: "minha_caixa",
      cartao: criterioDoCartao("atrasados", c),
    });
    const venceHoje = await contarChamados(tx, a.cx, {
      recorte: "minha_caixa",
      cartao: criterioDoCartao("vence_hoje", c),
    });
    const confirmar = await contarChamados(tx, a.cx, {
      recorte: "abertos_por_mim",
      status: ["concluido"],
    });
    const [ano = 0, mes = 1, d = 1] = hoje.split("-").map(Number);
    return {
      resumo: {
        nome: a.cx.usuario.nome,
        saudacao: saudacao(paraBrasilia(a.agora).hora),
        data: `${DIAS[new Date(Date.UTC(ano, mes - 1, d)).getUTCDay()]}, ${d} de ${MESES[mes - 1]}`,
        atrasados,
        hoje: venceHoje,
        confirmar,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Calendário: prazos, visitas de terceirizados, agendamentos e preventivas
// ---------------------------------------------------------------------------

/** Prazos dos chamados da tela que caem no intervalo. */
export function itensDePrazo(
  linhas: LinhaChamado[],
  de: string,
  ate: string,
): ItemCalendario[] {
  return linhas.flatMap((l) => {
    if (!l.prazo) return [];
    const { data, hora } = paraBrasilia(instante(l.prazo));
    if (data < de || data > ate) return [];
    return [
      {
        chave: `prazo:${l.id}`,
        tipo: l.origem === "preventiva" ? "preventiva" : "prazo",
        dia: data,
        hora,
        quando: hora,
        titulo: `${numeroDo(l)} ${l.titulo}`,
        detalhe: l.responsavel ?? "Na fila",
        chamadoId: l.id,
        href: null,
        status: l.status,
        prazo: l.prazo,
        arrastavel: l.podePrazo && !finalizado(l.status),
      } satisfies ItemCalendario,
    ];
  });
}

/**
 * Visitas de terceirizados (OS com data de visita) no intervalo. Com um
 * recorte de setor, só as OS daquele setor.
 */
export async function itensDeVisita(
  tx: Tx,
  de: string,
  ate: string,
  recorte: FiltroChamados | null,
): Promise<ItemCalendario[]> {
  const setores = recorte?.setores?.length
    ? recorte.setores
    : recorte?.setor
      ? [recorte.setor]
      : null;
  const linhas = await repo.visitas(tx, de, ate, setores);
  return linhas.flatMap((c) =>
    c.visita_data
      ? [
          {
            chave: `visita:${c.id}`,
            tipo: "visita",
            dia: c.visita_data,
            hora: null,
            quando: rotuloPeriodo(c.visita_periodo) ?? "Visita",
            titulo: `${formatarNumeroOS(c.numero)} ${c.titulo}`,
            detalhe: "Visita do terceirizado",
            chamadoId: c.id,
            href: null,
            status: c.status,
            prazo: null,
            arrastavel: false,
          } satisfies ItemCalendario,
        ]
      : [],
  );
}

/** Agendamentos marcados (todas as agendas) no intervalo. */
export async function itensDeAgendamento(
  tx: Tx,
  de: string,
  ate: string,
): Promise<ItemCalendario[]> {
  // Nome da agenda e da loja na mesma consulta (o RLS vale para os dois).
  const linhas = await agendamentosDoPeriodo(
    tx,
    deBrasilia(de).toISOString(),
    deBrasilia(somarDias(ate, 1)).toISOString(),
  );
  return linhas.map((g) => {
    const ini = paraBrasilia(instante(g.inicio));
    const fim = paraBrasilia(instante(g.fim));
    const loja = g.loja_nome ? `${g.loja_nome} (${g.loja_luc})` : null;
    return {
      chave: `agendamento:${g.id}`,
      tipo: "agendamento",
      dia: ini.data,
      hora: ini.hora,
      quando: `${ini.hora}–${fim.hora}`,
      titulo: `${g.agenda_nome ?? "Agenda"}${loja ? ` · ${loja}` : ""}`,
      detalhe:
        g.status === "remarcar"
          ? "Precisa remarcar"
          : g.status === "realizado"
            ? "Realizado"
            : (g.observacao ?? null),
      chamadoId: g.chamado_id,
      href: null,
      status: null,
      prazo: null,
      arrastavel: false,
    } satisfies ItemCalendario;
  });
}

/** Próximas datas dos planos preventivos (quem vê ativos). */
export async function itensDePlano(
  tx: Tx,
  a: Apoio,
  de: string,
  ate: string,
  setor: string | null,
): Promise<ItemCalendario[]> {
  if (!a.cx.pode("os.ativos") && !a.cx.pode("os.ativos_gerenciar")) return [];
  const planos = await repo.planosAte(tx, ate, setor);
  return planos.flatMap((p) =>
    datasDoPlano(p, de, ate).map(
      (dia) =>
        ({
          chave: `plano:${p.id}:${dia}`,
          tipo: "plano",
          dia,
          hora: null,
          quando: "Previsto",
          titulo: p.titulo,
          detalhe: p.ativo_codigo
            ? `${p.ativo_codigo} · ${p.ativo_nome}`
            : null,
          chamadoId: null,
          href: rotaAtivo(p.ativo_id),
          status: null,
          prazo: null,
          arrastavel: false,
        }) satisfies ItemCalendario,
    ),
  );
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** GET /os/visoes/calendario */
export function lerCalendario(
  ctx: Contexto,
  busca: Busca,
): Promise<RespostaCalendario> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const a = await apoio(tx, ctx);
    const { filtros, lembrados } = await filtrosDaTela(tx, "calendario", busca);
    const hoje = hojeEmBrasilia(a.agora);
    const dataBruta = umTexto(busca.data);
    const data = dataBruta && DATA.test(dataBruta) ? dataBruta : hoje;
    const visao = filtros.visao ?? "mes";
    const { de, ate } =
      visao === "periodo"
        ? periodoEscolhido(filtros.de, filtros.ate, data)
        : intervaloDaVisao(visao, data);

    const permitidos = recortesPermitidos(a);
    // Sem escolha, quem tem setor abre no mês do próprio setor.
    const padrao: Recorte = permitidos.includes("meu_setor")
      ? "meu_setor"
      : "minha_caixa";
    const recorte =
      filtros.recorte && permitidos.includes(filtros.recorte)
        ? filtros.recorte
        : padrao;
    const comSetor = recorte === "meu_setor" || recorte === "todos";
    const valores: Filtros = {
      ...filtros,
      recorte,
      setor: comSetor ? filtros.setor : undefined,
    };

    // Os prazos do período (chamados e OS, filtrados no banco), as visitas
    // das OS do recorte, os agendamentos e as preventivas. O tipo OS lê só
    // as OS; outro tipo, só os chamados.
    const consulta = paraConsulta({ ...valores, status: undefined }, recorte);
    const soOS = valores.tipo === "os";
    const semOS = !!valores.tipo && !soOS;
    const prazoEntre = {
      de: deBrasilia(de).toISOString(),
      ate: deBrasilia(somarDias(ate, 1)).toISOString(),
    };
    const chamados = soOS
      ? []
      : await buscarChamados(tx, a.cx, { ...consulta, prazoEntre });
    const ordens = semOS
      ? []
      : await buscarChamados(tx, a.cx, {
          ...consulta,
          ordens: true,
          prazoEntre,
        });
    const visitas = semOS
      ? []
      : await itensDeVisita(
          tx,
          de,
          ate,
          recorte === "todos" && !valores.setor ? null : consulta,
        );
    const agendamentos = await itensDeAgendamento(tx, de, ate);
    const planos = await itensDePlano(tx, a, de, ate, valores.setor ?? null);
    const linhas = [...chamados, ...ordens].map((c) => paraLinha(c, a));
    const setores =
      recorte === "todos"
        ? a.setores.filter((s) => s.ativo)
        : setoresDisponiveis(a);
    return {
      valores: paraResposta(valores),
      lembrados,
      permitidos,
      padrao,
      comSetor,
      setores: setores.map((s) => s.id),
      visao,
      data,
      hoje,
      de,
      ate,
      itens: [
        ...itensDePrazo(linhas, de, ate),
        ...visitas,
        ...agendamentos,
        ...planos,
      ],
      agora: a.agora.toISOString(),
    };
  });
}
