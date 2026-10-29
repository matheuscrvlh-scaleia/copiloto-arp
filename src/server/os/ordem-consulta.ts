import "server-only";
import type { QueryData } from "@supabase/supabase-js";
import { cache } from "react";
import type { Sessao } from "@/lib/os/calculos";
import {
  buscaNoOr,
  type Filtravel,
  listaNoOr,
  termoDeBusca,
  totalForaDoIntervalo,
} from "@/lib/os/filtro-postgrest";
import { localDaOS, paraSessao, tipoDeServico } from "@/lib/os/ordem";
import {
  CARTOES_OS,
  type CartaoOS,
  type CriterioDoCartao,
  criadasEntre,
  criterioDoCartao,
  type FiltrosOS,
  localConfere,
  statusDoFiltro,
} from "@/lib/os/ordem-lista";
import { intervalo } from "@/lib/os/paginacao";
import type { OSRelatorio } from "@/lib/os/relatorios";
import type { Execucao, StatusChamado } from "@/lib/os/rotulos";
import { categorias, nomes, os, type Tabela } from "./base";
import { lojasDoModulo } from "./lojas";

// Consulta das Ordens de Serviço com tudo o que as listas, o PDF e os
// relatórios mostram (sessões, técnicos, terceirizado e, para quem vê
// custos, o resultado gravado). Sempre pela sessão: o RLS decide as OS e
// esconde os_custos de quem não tem os.custos.

const COLUNAS_OS =
  "id, numero, tipo, titulo, descricao, setor_id, categoria_id, status, prioridade, aguardando_tipo, aberto_por, solicitante_nome, responsavel_id, loja_id, ativo_id, execucao, local, bloco, empresa_id, visita_data, visita_periodo, prazo_terceirizado, solucao, causa_falha, ativo_parado, rateio, assinatura_nome, assinatura_path, assinado_em, concluido_em, fechado_em, fechado_por, cancelado_em, criado_em, legado_origem, sessoes(id, data, inicio, fim, almoco_inicio, almoco_fim, sessao_tecnicos(tecnico_id)), ordem_profissionais(profissional_id), os_custos(custo_total, valor_rateio, custo_mao_obra, custo_materiais, valor_terceirizado, completo, legado_valor, legado_valor_rateio)" as const;

function consultaBase(db: Awaited<ReturnType<typeof os>>) {
  return db.from("ordens").select(COLUNAS_OS);
}

export type LinhaOS = QueryData<ReturnType<typeof consultaBase>>[number];

export interface FiltroOS {
  ids?: string[];
  /** Só OS (padrão) ou qualquer chamado (impressão pelo id). */
  soOS?: boolean;
  status?: StatusChamado[];
  execucao?: Execucao | null;
  categoria?: string | null;
  empresa?: string | null;
  rateio?: boolean | null;
  /** Criadas de / até (aaaa-mm-dd, Brasília, inclusive). */
  de?: string | null;
  ate?: string | null;
  /** Fechadas de / até (relatórios de finalizadas). */
  fechadoDe?: string | null;
  fechadoAte?: string | null;
  limite?: number;
}

/** O PostgREST devolve no máximo 1000 linhas por pedido. */
const PAGINA = 1000;

/**
 * Lê página a página até acabar (ou até `limite`). `pagina` monta a
 * consulta de novo a cada volta, com uma ordem estável (ex.: por id).
 */
export async function todasAsLinhas<T>(
  pagina: (
    de: number,
    ate: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  limite = Number.POSITIVE_INFINITY,
): Promise<T[]> {
  const linhas: T[] = [];
  while (linhas.length < limite) {
    const de = linhas.length;
    const ate = Math.min(de + PAGINA, limite) - 1;
    const { data, error } = await pagina(de, ate);
    if (error) throw new Error(`Falha ao ler o banco: ${error.message}`);
    const lidas = data ?? [];
    linhas.push(...lidas);
    if (lidas.length < ate - de + 1) break;
  }
  return linhas;
}

/** OS que o usuário vê, já com sessões, profissionais e custos (RLS). */
export async function consultarOS(f: FiltroOS = {}): Promise<LinhaOS[]> {
  const db = await os();
  const montar = () => {
    let q = consultaBase(db).order("numero", { ascending: false });
    if (f.ids) q = q.in("id", f.ids);
    if (f.soOS ?? true) q = q.eq("tipo", "os");
    if (f.status?.length) q = q.in("status", f.status);
    if (f.execucao) q = q.eq("execucao", f.execucao);
    if (f.categoria) q = q.eq("categoria_id", f.categoria);
    if (f.empresa) q = q.eq("empresa_id", f.empresa);
    if (f.rateio != null) q = q.eq("rateio", f.rateio);
    if (f.de) q = q.gte("criado_em", `${f.de}T00:00:00-03:00`);
    if (f.ate) q = q.lte("criado_em", `${f.ate}T23:59:59.999-03:00`);
    if (f.fechadoDe) q = q.gte("fechado_em", `${f.fechadoDe}T00:00:00-03:00`);
    if (f.fechadoAte)
      q = q.lte("fechado_em", `${f.fechadoAte}T23:59:59.999-03:00`);
    return q;
  };
  return todasAsLinhas(
    (de, ate) => montar().range(de, ate),
    f.limite ?? PAGINA,
  );
}

export interface Cadastros {
  tecnicos: Map<string, Tabela<"tecnicos">>;
  empresas: Map<string, Tabela<"empresas">>;
  profissionais: Map<string, Tabela<"profissionais">>;
  lojas: Map<
    string,
    Pick<
      Tabela<"lojas">,
      "id" | "luc" | "nome" | "bloco" | "situacao" | "telefone"
    >
  >;
  categorias: Map<string, Tabela<"categorias">>;
  pessoas: Map<string, string>;
}

/** Nomes de técnicos, empresas, lojas, categorias e pessoas (uma vez por tela). */
export const cadastros = cache(async (): Promise<Cadastros> => {
  const db = await os();
  // Lojas: um contrato por linha (passa de mil), do cache do módulo.
  const [tecnicos, empresas, profissionais, lojas, cats, pessoas] =
    await Promise.all([
      db.from("tecnicos").select("*").order("nome"),
      db.from("empresas").select("*").order("nome"),
      db.from("profissionais").select("*").order("nome"),
      lojasDoModulo(),
      categorias(),
      nomes(),
    ]);
  for (const r of [tecnicos, empresas, profissionais])
    if (r.error)
      throw new Error(`Falha ao ler os cadastros: ${r.error.message}`);
  const porId = <T extends { id: string }>(l: T[] | null) =>
    new Map((l ?? []).map((x) => [x.id, x]));
  return {
    tecnicos: porId(tecnicos.data),
    empresas: porId(empresas.data),
    profissionais: porId(profissionais.data),
    lojas: porId(lojas),
    categorias: porId(cats),
    pessoas,
  };
});

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
  o: Pick<LinhaOS, "bloco" | "local" | "loja_id">,
  c: Cadastros,
): string {
  const loja = o.loja_id ? (c.lojas.get(o.loja_id) ?? null) : null;
  return localDaOS({ bloco: o.bloco, local: o.local, loja });
}

export function tipoServicoDa(
  o: Pick<LinhaOS, "categoria_id">,
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

/** Filtros da tela já resolvidos para o banco. */
export interface FiltroListaOS {
  status: StatusChamado[];
  execucao: Execucao | null;
  categoria: string | null;
  empresa: string | null;
  rateio: boolean | null;
  tecnico: string | null;
  /** Criadas de / até (aaaa-mm-dd, Brasília, inclusive). */
  de: string | null;
  ate: string | null;
  /** `.or()` do local digitado (local, bloco e lojas que conferem). */
  local: string | null;
  /** `.or()` da busca (número, título, descrição). */
  busca: string | null;
}

/** Lojas que entram na busca do local por LUC e nome (a URL tem limite). */
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
  let local: string | null = null;
  const t = termoDeBusca(f.local);
  if (t) {
    const lojas = [...cad.lojas.values()]
      .filter((l) => localConfere(`${l.luc} · ${l.nome}`, t))
      .slice(0, MAX_LOJAS_NO_LOCAL)
      .map((l) => l.id);
    const bloco = t.replace(/^bloco\s+/i, "");
    local = [
      `local.ilike.*${t}*`,
      `bloco.ilike.*${bloco}*`,
      listaNoOr("loja_id", lojas),
      // Sem loja, bloco nem ponto, a tela mostra "Área comum".
      localConfere("Área comum", t)
        ? "and(loja_id.is.null,bloco.is.null,local.is.null)"
        : null,
    ]
      .filter(Boolean)
      .join(",");
  }
  return {
    status: statusDoFiltro(f.status),
    execucao: f.execucao,
    categoria: f.categoria,
    empresa: f.empresa,
    rateio: f.rateio,
    tecnico: f.tecnico,
    de: periodo.de,
    ate: periodo.ate,
    local,
    busca: buscaNoOr(f.q, ["titulo", "descricao"], "numero"),
  };
}

/**
 * Técnico filtra pelas sessões: um segundo embutido das sessões, com
 * !inner, deixa só as OS em que ele trabalhou sem cortar as outras
 * sessões da OS (que somam o tempo).
 */
const comTecnico = (colunas: string, f: FiltroListaOS) =>
  f.tecnico
    ? `${colunas}, ftec:sessoes!inner(sessao_tecnicos!inner(tecnico_id))`
    : colunas;

function filtrarOS<Q extends Filtravel<Q>>(
  q: Q,
  f: FiltroListaOS,
  extra: CriterioDoCartao | null,
  rodando: string[],
): Q {
  let c = q.eq("tipo", "os");
  if (f.status.length) c = c.in("status", f.status);
  if (f.execucao) c = c.eq("execucao", f.execucao);
  if (f.categoria) c = c.eq("categoria_id", f.categoria);
  if (f.empresa) c = c.eq("empresa_id", f.empresa);
  if (f.rateio !== null) c = c.eq("rateio", f.rateio);
  if (f.tecnico) c = c.eq("ftec.sessao_tecnicos.tecnico_id", f.tecnico);
  if (f.de) c = c.gte("criado_em", `${f.de}T00:00:00-03:00`);
  if (f.ate) c = c.lte("criado_em", `${f.ate}T23:59:59.999-03:00`);
  if (f.local) c = c.or(f.local);
  if (f.busca) c = c.or(f.busca);
  if (extra) {
    // Dois filtros na mesma coluna somam (status do filtro E do cartão).
    if (extra.status) c = c.in("status", extra.status);
    if (extra.execucao) c = c.eq("execucao", extra.execucao);
    if (extra.fechadoEntre)
      c = c
        .gte("fechado_em", extra.fechadoEntre.de)
        .lt("fechado_em", extra.fechadoEntre.ate);
    if (extra.rodando) c = c.in("id", rodando);
  }
  return c;
}

/** OS com o cronômetro rodando agora (sessões abertas: são poucas). */
const osRodando = cache(async (): Promise<string[]> => {
  const { data, error } = await (await os())
    .from("sessoes")
    .select("ordem_id")
    .is("fim", null)
    .limit(500);
  if (error) throw new Error(`Falha ao ler as sessões: ${error.message}`);
  return [...new Set((data ?? []).map((s) => s.ordem_id))];
});

/** Uma página da lista (a mais recente primeiro) e o total do filtro. */
export async function paginaDeOS(
  f: FiltroListaOS,
  cartao: CartaoOS | null,
  pagina: number,
  agora: Date,
): Promise<{ linhas: LinhaOS[]; total: number }> {
  const db = await os();
  const extra = cartao ? criterioDoCartao(cartao, agora) : null;
  const rodando = extra?.rodando ? await osRodando() : [];
  const { de, ate } = intervalo(pagina);
  const { data, error, count } = await filtrarOS(
    db.from("ordens").select(comTecnico(COLUNAS_OS, f) as typeof COLUNAS_OS, {
      count: "exact",
    }),
    f,
    extra,
    rodando,
  )
    .order("numero", { ascending: false })
    .range(de, ate);
  if (error) {
    const total = totalForaDoIntervalo(error);
    if (total !== null) return { linhas: [], total };
    throw new Error(`Falha ao ler as OS: ${error.message}`);
  }
  return { linhas: data ?? [], total: count ?? 0 };
}

/** Os quatro cartões: contagens no banco, com os filtros da tela. */
export async function contarCartoesOS(
  f: FiltroListaOS,
  agora: Date,
): Promise<Record<CartaoOS, number>> {
  const db = await os();
  const rodando = await osRodando();
  const chaves = Object.keys(CARTOES_OS) as CartaoOS[];
  const contagens = await Promise.all(
    chaves.map(async (c) => {
      const { count, error } = await filtrarOS(
        db
          .from("ordens")
          .select(comTecnico("id", f) as "id", { count: "exact", head: true }),
        f,
        criterioDoCartao(c, agora),
        rodando,
      );
      if (error) throw new Error(`Falha ao contar as OS: ${error.message}`);
      return [c, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(contagens) as Record<CartaoOS, number>;
}

/** Teto da exportação (o arquivo leva o filtro inteiro, de mil em mil). */
export const MAXIMO_EXPORTAR_OS = 10_000;

/** Todas as OS do filtro, para exportar (lidas só no clique). */
export async function osDoFiltro(
  f: FiltroListaOS,
  cartao: CartaoOS | null,
  agora: Date,
): Promise<LinhaOS[]> {
  const db = await os();
  const extra = cartao ? criterioDoCartao(cartao, agora) : null;
  const rodando = extra?.rodando ? await osRodando() : [];
  return todasAsLinhas(
    (de, ate) =>
      filtrarOS(
        db
          .from("ordens")
          .select(comTecnico(COLUNAS_OS, f) as typeof COLUNAS_OS),
        f,
        extra,
        rodando,
      )
        .order("numero", { ascending: false })
        .range(de, ate),
    MAXIMO_EXPORTAR_OS,
  );
}
