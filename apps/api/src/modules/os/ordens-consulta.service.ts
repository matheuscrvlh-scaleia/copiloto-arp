import {
  descreverPeriodos,
  formatarDuracao,
  minutoHomem,
  minutosDaOS,
  type Sessao,
} from "@arp/shared/os/calculos";
import type { RespostaOrdens } from "@arp/shared/os/contratos/ordens";
import type { Planilha } from "@arp/shared/os/contratos/visoes";
import { termoDeBusca } from "@arp/shared/os/filtro-postgrest";
import { localDaOS, paraSessao, tipoDeServico } from "@arp/shared/os/ordem";
import {
  CARTOES_OS,
  type CartaoOS,
  criadasEntre,
  criterioDoCartao,
  EM_ABERTO,
  FILTROS_STATUS,
  type FiltrosOS,
  lerFiltrosOS,
  localConfere,
  NA_FILA,
  PERIODOS_OS,
  statusDoFiltro,
} from "@arp/shared/os/ordem-lista";
import { intervalo, paginaDaUrl } from "@arp/shared/os/paginacao";
import type { OSRelatorio } from "@arp/shared/os/relatorios";
import { PARAM_PAINEL } from "@arp/shared/os/rotas";
import { EXECUCOES } from "@arp/shared/os/rotulos";
import {
  colunasDeOS,
  type LinhaOSTela,
  linhaDeOS,
} from "@arp/shared/os/tabela-ordens";
import { paraBrasilia } from "@arp/shared/os/tempo";
import type { Contexto } from "@/contexto";
import { ErroDeNegocio, ErroDePermissao } from "@/erros";
import { banco, type Tx } from "@/infra/banco";
import {
  type Categoria,
  categorias,
  nomes,
  type Setor,
  setores,
} from "./base.service";
import { type LojaResumo, lojasDoModulo } from "./lojas.repository";
import type {
  Empresa,
  FiltroListaOS,
  LinhaOS,
  Profissional,
  Tecnico,
} from "./ordens.repository";
import * as repo from "./ordens.repository";

// Consulta das Ordens de Serviço com tudo o que as listas, o PDF e os
// relatórios mostram (sessões, técnicos, terceirizado e, para quem vê
// custos, o resultado gravado). Sempre pela sessão: o RLS decide as OS e
// esconde os_custos de quem não tem os.custos.

export type { FiltroListaOS, FiltroOS, LinhaOS } from "./ordens.repository";
export { consultarOS } from "./ordens.repository";

export interface Cadastros {
  tecnicos: Map<string, Tecnico>;
  empresas: Map<string, Empresa>;
  profissionais: Map<string, Profissional>;
  lojas: Map<string, LojaResumo>;
  categorias: Map<string, Categoria>;
  setores: Map<string, Setor>;
  pessoas: Map<string, string>;
}

const porId = <T extends { id: string }>(l: T[]) =>
  new Map(l.map((x) => [x.id, x]));

/** Nomes de técnicos, empresas, lojas, categorias e pessoas (uma vez por pedido). */
export async function cadastros(tx: Tx): Promise<Cadastros> {
  return {
    tecnicos: porId(await repo.tecnicos(tx)),
    empresas: porId(await repo.empresas(tx)),
    profissionais: porId(await repo.profissionais(tx)),
    lojas: porId(await lojasDoModulo(tx)),
    categorias: porId(await categorias(tx)),
    setores: porId(await setores(tx)),
    pessoas: await nomes(tx),
  };
}

export function sessoesDa(o: Pick<LinhaOS, "sessoes">): Sessao[] {
  return o.sessoes.map(paraSessao);
}

/** Técnicos na ordem em que aparecem nas sessões, sem repetir. */
export function tecnicosDa(
  o: Pick<LinhaOS, "sessoes">,
  c: Cadastros,
): string[] {
  const ordem = [...o.sessoes].sort((a, b) =>
    `${a.data} ${a.inicio}`.localeCompare(`${b.data} ${b.inicio}`),
  );
  const ids = [
    ...new Set(
      ordem.flatMap((s) => s.sessao_tecnicos.map((t) => t.tecnico_id)),
    ),
  ];
  return ids.map((id) => c.tecnicos.get(id)?.nome ?? "Técnico removido");
}

export function profissionaisDa(
  o: Pick<LinhaOS, "ordem_profissionais">,
  c: Cadastros,
): string[] {
  return o.ordem_profissionais
    .map((p) => c.profissionais.get(p.profissional_id)?.nome)
    .filter((n): n is string => !!n);
}

export function localDa(
  o: { bloco: string | null; local: string | null; loja_id: string | null },
  c: Cadastros,
): string {
  const loja = o.loja_id ? (c.lojas.get(o.loja_id) ?? null) : null;
  return localDaOS({ bloco: o.bloco, local: o.local, loja });
}

export function tipoServicoDa(
  o: { categoria_id: string | null },
  c: Cadastros,
): string {
  return tipoDeServico(
    o.categoria_id ? c.categorias.get(o.categoria_id)?.nome : null,
  );
}

/**
 * Valor da O.S. e com rateio: o resultado gravado; a OS importada que
 * ainda não foi recalculada mostra o valor do sistema atual.
 */
export function valoresDa(o: Pick<LinhaOS, "os_custos">): {
  valor: number | null;
  valorRateio: number | null;
} {
  const k = o.os_custos;
  if (!k) return { valor: null, valorRateio: null };
  return {
    valor: k.custo_total ?? k.legado_valor,
    valorRateio: k.valor_rateio ?? k.legado_valor_rateio,
  };
}

/** Linha dos relatórios; sem os.custos, os valores ficam em branco. */
export function paraRelatorio(
  o: LinhaOS,
  c: Cadastros,
  comCustos: boolean,
): OSRelatorio {
  const v = comCustos ? valoresDa(o) : { valor: null, valorRateio: null };
  const pessoa = (id: string | null) => (id ? (c.pessoas.get(id) ?? "") : "");
  return {
    numero: o.numero,
    titulo: o.titulo,
    descricao: o.descricao,
    tipoServico: tipoServicoDa(o, c),
    status: o.status,
    rateio: o.rateio,
    criadoEm: o.criado_em,
    criadoPor: pessoa(o.aberto_por) || (o.solicitante_nome ?? ""),
    fechadoEm: o.fechado_em,
    fechadoPor: o.fechado_em
      ? pessoa(o.fechado_por) || "Fechamento automático"
      : "",
    sessoes: sessoesDa(o),
    tecnicos: tecnicosDa(o, c),
    valor: comCustos ? (v.valor ?? 0) : null,
    valorRateio: comCustos ? (v.valorRateio ?? 0) : null,
    visitaPeriodo: o.visita_periodo,
    visitaData: o.visita_data,
    profissionais: profissionaisDa(o, c),
    solucao: o.solucao,
  };
}

// ---------------------------------------------------------------------------
// Lista paginada da tela Ordens de serviço
// ---------------------------------------------------------------------------

/** Lojas que entram na busca do local por LUC e nome. */
const MAX_LOJAS_NO_LOCAL = 150;

/**
 * Resolve os filtros da URL para a consulta. O local na tela junta loja,
 * bloco e ponto: no banco vira local/bloco por texto e as lojas cujo nome
 * ou LUC confere (lidas dos cadastros, que a tela já carrega).
 */
export function filtroDaListaOS(
  f: FiltrosOS,
  cad: Cadastros,
  agora: Date,
): FiltroListaOS {
  const periodo = criadasEntre(f, agora);
  let local: FiltroListaOS["local"] = null;
  const t = termoDeBusca(f.local);
  if (t)
    local = {
      termo: t,
      bloco: t.replace(/^bloco\s+/i, ""),
      lojas: [...cad.lojas.values()]
        .filter((l) => localConfere(`${l.luc} · ${l.nome}`, t))
        .slice(0, MAX_LOJAS_NO_LOCAL)
        .map((l) => l.id),
      areaComum: localConfere("Área comum", t),
    };
  const q = termoDeBusca(f.q);
  const n = q?.replace(/^#/, "") ?? "";
  return {
    status: statusDoFiltro(f.status),
    execucao: f.execucao,
    setor: f.setor,
    responsavel: f.responsavel === NA_FILA ? null : f.responsavel,
    semResponsavel: f.responsavel === NA_FILA,
    categoria: f.categoria,
    empresa: f.empresa,
    rateio: f.rateio,
    tecnico: f.tecnico,
    de: periodo.de,
    ate: periodo.ate,
    local,
    busca: q
      ? { termo: q, numero: /^\d{1,9}$/.test(n) ? Number(n) : null }
      : null,
  };
}

/** Uma página da lista (a mais recente primeiro) e o total do filtro. */
export async function paginaDeOS(
  tx: Tx,
  f: FiltroListaOS,
  cartao: CartaoOS | null,
  pagina: number,
  agora: Date,
): Promise<{ linhas: LinhaOS[]; total: number }> {
  const extra = cartao ? criterioDoCartao(cartao, agora) : null;
  const { de, ate } = intervalo(pagina);
  const total = await repo.contarOS(tx, f, extra);
  // Página além do fim: a tela volta para a última.
  if (de >= total) return { linhas: [], total };
  const linhas = await repo.trechoDeOS(tx, f, extra, {
    limite: ate - de + 1,
    pular: de,
  });
  return { linhas, total };
}

const CARTOES: CartaoOS[] = [
  "abertas",
  "atrasadas",
  "em_execucao",
  "terceirizadas",
  "finalizadas_mes",
];

/** Os cartões: contagens no banco, com os filtros da tela. */
export async function contarCartoesOS(
  tx: Tx,
  f: FiltroListaOS,
  agora: Date,
): Promise<Record<CartaoOS, number>> {
  const contagem: Record<CartaoOS, number> = {
    abertas: 0,
    atrasadas: 0,
    em_execucao: 0,
    terceirizadas: 0,
    finalizadas_mes: 0,
  };
  for (const c of CARTOES)
    contagem[c] = await repo.contarOS(tx, f, criterioDoCartao(c, agora));
  return contagem;
}

/** Teto da exportação (o arquivo leva o filtro inteiro). */
export const MAXIMO_EXPORTAR_OS = 10_000;

/** Todas as OS do filtro, para exportar (lidas só no clique). */
export function osDoFiltro(
  tx: Tx,
  f: FiltroListaOS,
  cartao: CartaoOS | null,
  agora: Date,
): Promise<LinhaOS[]> {
  return repo.trechoDeOS(
    tx,
    f,
    cartao ? criterioDoCartao(cartao, agora) : null,
    { limite: MAXIMO_EXPORTAR_OS },
  );
}

// ---------------------------------------------------------------------------
// Da OS lida no banco para a linha da tela (e do arquivo exportado)
// ---------------------------------------------------------------------------

export const CAMINHO_ORDENS = "/os/ordens";

/** Parâmetros da URL da tela (os filtros), como vieram. */
export type Busca = Record<string, string | string[] | undefined>;

/** A consulta do pedido só com texto (o resto é ignorado). */
function buscaDe(consulta: Record<string, unknown>): Busca {
  const b: Busca = {};
  for (const [k, v] of Object.entries(consulta)) {
    if (typeof v === "string") b[k] = v;
    else if (Array.isArray(v))
      b[k] = v.filter((x): x is string => typeof x === "string");
  }
  return b;
}

export function paraTela(
  o: LinhaOS,
  cad: Cadastros,
  comCustos: boolean,
  params: Busca,
  agora: Date,
): LinhaOSTela {
  const sessoes = sessoesDa(o);
  const minutos = minutosDaOS(sessoes);
  const mh = minutoHomem(sessoes);
  const v = comCustos ? valoresDa(o) : { valor: null, valorRateio: null };
  const painel = new URLSearchParams();
  for (const [k, x] of Object.entries(params))
    if (k !== PARAM_PAINEL && typeof x === "string") painel.set(k, x);
  painel.set(PARAM_PAINEL, o.id);
  return {
    id: o.id,
    numero: o.numero,
    titulo: o.titulo,
    status: o.status,
    aguardando: o.aguardando_tipo,
    execucao: o.execucao,
    tipoServico: tipoServicoDa(o, cad),
    local: localDa(o, cad),
    setor: cad.setores.get(o.setor_id)?.nome ?? "Setor",
    responsavel: o.responsavel_id
      ? (cad.pessoas.get(o.responsavel_id) ?? "Usuário inativo")
      : "Na fila",
    prazo: o.prazo,
    atrasada:
      !!o.prazo &&
      EM_ABERTO.includes(o.status) &&
      new Date(o.prazo).getTime() < agora.getTime(),
    tecnicos:
      o.execucao === "terceirizada" && o.empresa_id
        ? [cad.empresas.get(o.empresa_id)?.nome, ...tecnicosDa(o, cad)]
            .filter(Boolean)
            .join(", ")
        : tecnicosDa(o, cad).join(", "),
    periodos: descreverPeriodos(sessoes),
    minutos,
    duracao: formatarDuracao(minutos),
    minutoHomem: mh,
    hh: formatarDuracao(mh),
    rodando: sessoes.some((s) => s.fim === null),
    rateio: o.rateio,
    valor: comCustos ? (v.valor ?? 0) : null,
    valorRateio: comCustos ? (v.valorRateio ?? 0) : null,
    href: `${CAMINHO_ORDENS}?${painel.toString()}`,
  };
}

const dataBr = (d: string) => d.split("-").reverse().join("/");

/** Linha de filtros do arquivo exportado. */
export function descreverFiltros(f: FiltrosOS, cad: Cadastros): string {
  const partes = [
    f.q && `Busca: ${f.q}`,
    f.status && `Status: ${FILTROS_STATUS[f.status]}`,
    f.execucao && `Execução: ${EXECUCOES[f.execucao]}`,
    f.setor && `Setor: ${cad.setores.get(f.setor)?.nome ?? "—"}`,
    f.responsavel &&
      `Responsável: ${f.responsavel === NA_FILA ? "na fila" : (cad.pessoas.get(f.responsavel) ?? "—")}`,
    f.periodo && `Criadas: ${PERIODOS_OS[f.periodo].toLowerCase()}`,
    !f.periodo &&
      (f.de || f.ate) &&
      `Criadas: ${f.de ? dataBr(f.de) : "início"} a ${f.ate ? dataBr(f.ate) : "hoje"}`,
    f.categoria && `Tipo: ${cad.categorias.get(f.categoria)?.nome ?? "—"}`,
    f.tecnico && `Técnico: ${cad.tecnicos.get(f.tecnico)?.nome ?? "—"}`,
    f.empresa && `Empresa: ${cad.empresas.get(f.empresa)?.nome ?? "—"}`,
    f.rateio !== null && `Rateio: ${f.rateio ? "Sim" : "Não"}`,
    f.local && `Local: ${f.local}`,
    f.cartao && CARTOES_OS[f.cartao],
  ].filter(Boolean);
  return partes.length ? partes.join(" · ") : "Todas as OS";
}

/** Setores ativos e pessoas do módulo, para os filtros do painel. */
export function opcoesDeSetorEPessoa(cad: Cadastros) {
  return {
    setores: [...cad.setores.values()]
      .filter((s) => s.ativo)
      .map((s) => ({ valor: s.id, rotulo: s.nome })),
    pessoas: [
      { valor: NA_FILA, rotulo: "Na fila (sem responsável)" },
      ...[...cad.pessoas.entries()]
        .map(([valor, rotulo]) => ({ valor, rotulo }))
        .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR")),
    ],
  };
}

export function opcoesDeCategoria(cad: Cadastros) {
  return [...cad.categorias.values()]
    .filter((c) => c.tipo_padrao === "os" || c.registrar_tempo)
    .map((c) => ({
      valor: c.id,
      rotulo: c.nome,
      descricao: c.pai_id ? cad.categorias.get(c.pai_id)?.nome : undefined,
    }));
}

// ---------------------------------------------------------------------------
// GET /os/ordens e /os/ordens/exportacao
// ---------------------------------------------------------------------------

/** A tela Acompanhamento das OS: a página pedida, os cartões e os filtros. */
export function listar(
  ctx: Contexto,
  consulta: Record<string, unknown>,
): Promise<RespostaOrdens> {
  const params = buscaDe(consulta);
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const f = lerFiltrosOS(params);
    const pagina = paginaDaUrl(params.pagina);
    const agora = new Date();
    const cad = await cadastros(tx);
    // Só a página mostrada vem do banco; os cartões são contagens.
    const filtro = filtroDaListaOS(f, cad, agora);
    const pag = await paginaDeOS(tx, filtro, f.cartao, pagina, agora);
    const contagem = await contarCartoesOS(tx, filtro, agora);
    const comCustos = ctx.permissoes.has("os.custos");
    const { setores: opSetores, pessoas } = opcoesDeSetorEPessoa(cad);
    const br = paraBrasilia(agora);
    return {
      hora: br.hora,
      hoje: br.data,
      linhas: pag.linhas.map((o) => paraTela(o, cad, comCustos, params, agora)),
      total: pag.total,
      contagem,
      comCustos,
      podeExportar: ctx.permissoes.has("os.exportar"),
      filtros: descreverFiltros(f, cad),
      opcoes: {
        setores: opSetores,
        pessoas,
        categorias: opcoesDeCategoria(cad),
        tecnicos: [...cad.tecnicos.values()].map((t) => ({
          valor: t.id,
          rotulo: t.nome,
          descricao: t.desligado_em ? "desligado" : undefined,
        })),
        empresas: [...cad.empresas.values()].map((e) => ({
          valor: e.id,
          rotulo: e.nome,
        })),
      },
    };
  });
}

/**
 * Exportar as OS: o arquivo leva o filtro inteiro (não só a página), lido
 * no clique, com as mesmas regras da tela e pelo RLS.
 */
export function exportar(
  ctx: Contexto,
  consulta: Record<string, unknown>,
): Promise<Planilha> {
  const chaves = Object.entries(consulta);
  if (
    chaves.length > 40 ||
    chaves.some(
      ([k, v]) => k.length > 40 || typeof v !== "string" || v.length > 400,
    )
  )
    throw new ErroDeNegocio("Pedido inválido.");
  if (!ctx.permissoes.has("os.acessar") || !ctx.permissoes.has("os.exportar"))
    throw new ErroDePermissao("Sem permissão para exportar.");
  const params = buscaDe(consulta);
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const cad = await cadastros(tx);
    const agora = new Date();
    const f = lerFiltrosOS(params);
    const lista = await osDoFiltro(
      tx,
      filtroDaListaOS(f, cad, agora),
      f.cartao,
      agora,
    );
    const comCustos = ctx.permissoes.has("os.custos");
    return {
      colunas: colunasDeOS(comCustos),
      linhas: lista.map((o) =>
        linhaDeOS(paraTela(o, cad, comCustos, {}, agora), comCustos),
      ),
    };
  });
}
