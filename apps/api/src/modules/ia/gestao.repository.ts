import { sql } from "kysely";
import type { Tx } from "@/infra/banco";
import { INICIO_DO_MES } from "./assistente.repository";

// Consultas da gestão da IA (ia.gerenciar): configuração, limites e o
// painel de uso. Somas e agrupamentos no SQL; datas no fuso de Brasília.

const FUSO = "America/Sao_Paulo";

export function config(tx: Tx) {
  return tx.selectFrom("ia.config").selectAll().executeTakeFirstOrThrow();
}

export function salvarConfig(
  tx: Tx,
  c: {
    ativa: boolean;
    esforco: string;
    max_consultas: number;
    limite_padrao_mes: number | null;
    orcamento_mes_usd: number | null;
    dias_de_guarda: number;
    cotacao_dolar: number;
    precos: unknown;
    instrucoes: string;
  },
) {
  return tx
    .updateTable("ia.config")
    .set({
      ...c,
      precos: JSON.stringify(c.precos),
      atualizado_por: sql`auth.uid()`,
      atualizado_em: sql`now()`,
    })
    .execute();
}

export function limites(tx: Tx) {
  return tx
    .selectFrom("ia.limites as l")
    .leftJoin("core.cargos as c", "c.id", "l.cargo_id")
    .leftJoin("core.usuarios as u", "u.id", "l.usuario_id")
    .select([
      "l.cargo_id",
      "l.usuario_id",
      "l.tokens_mes",
      sql<string>`coalesce(c.nome, u.nome, '—')`.as("nome"),
    ])
    .orderBy(sql`l.cargo_id is null`)
    .orderBy(sql`coalesce(c.nome, u.nome)`)
    .execute();
}

export function cargos(tx: Tx) {
  return tx
    .selectFrom("core.cargos")
    .select(["id", "nome"])
    .where("ativo", "=", true)
    .orderBy("nome")
    .execute();
}

export function usuarios(tx: Tx) {
  return tx
    .selectFrom("core.usuarios as u")
    .leftJoin("core.cargos as c", "c.id", "u.cargo_id")
    .select(["u.id", "u.nome", "c.nome as cargo"])
    .where("u.ativo", "=", true)
    .orderBy("u.nome")
    .execute();
}

export async function salvarLimite(
  tx: Tx,
  l: { tipo: "cargo" | "usuario"; id: string; tokens_mes: number | null },
) {
  const coluna = l.tipo === "cargo" ? "cargo_id" : "usuario_id";
  await tx
    .insertInto("ia.limites")
    .values({ [coluna]: l.id, tokens_mes: l.tokens_mes })
    .onConflict((oc) =>
      oc.column(coluna).doUpdateSet({
        tokens_mes: l.tokens_mes,
        atualizado_por: sql`auth.uid()`,
        atualizado_em: sql`now()`,
      }),
    )
    .execute();
}

export async function removerLimite(
  tx: Tx,
  l: { tipo: "cargo" | "usuario"; id: string },
): Promise<boolean> {
  const r = await tx
    .deleteFrom("ia.limites")
    .where(l.tipo === "cargo" ? "cargo_id" : "usuario_id", "=", l.id)
    .executeTakeFirst();
  return r.numDeletedRows > 0n;
}

// ---------------------------------------------------------------------------
// Painel de uso
// ---------------------------------------------------------------------------

/** Linhas de ia.uso dentro do período (dias de Brasília, fim incluso). */
function noPeriodo(tx: Tx, de: string, ate: string) {
  return tx
    .selectFrom("ia.uso as x")
    .where(
      "x.criado_em",
      ">=",
      sql<string>`(${de}::date)::timestamp at time zone ${FUSO}`,
    )
    .where(
      "x.criado_em",
      "<",
      sql<string>`(${ate}::date + 1)::timestamp at time zone ${FUSO}`,
    );
}

const PERGUNTA = sql<boolean>`x.status <> 'limite'`;
const n = (expr: ReturnType<typeof sql>) =>
  sql<number>`coalesce(${expr}, 0)::float8`;

export async function resumo(tx: Tx, de: string, ate: string) {
  return noPeriodo(tx, de, ate)
    .select([
      n(sql`count(*) filter (where ${PERGUNTA})`).as("perguntas"),
      n(sql`count(distinct x.usuario_id) filter (where ${PERGUNTA})`).as(
        "pessoas",
      ),
      n(sql`count(distinct x.conversa_id)`).as("conversas"),
      n(sql`sum(x.tokens_entrada)`).as("tokens_entrada"),
      n(sql`sum(x.tokens_saida)`).as("tokens_saida"),
      n(sql`sum(x.tokens_cache_escrita + x.tokens_cache_leitura)`).as(
        "tokens_cache",
      ),
      n(sql`sum(x.custo_usd)`).as("custo_usd"),
      n(sql`avg(x.duracao_ms) filter (where x.status = 'ok')`).as(
        "tempo_medio_ms",
      ),
      n(sql`sum(x.consultas)`).as("consultas"),
      n(sql`count(*) filter (where x.status = 'erro')`).as("erros"),
      n(sql`count(*) filter (where x.avaliacao = 1)`).as("positivas"),
      n(sql`count(*) filter (where x.avaliacao = -1)`).as("negativas"),
    ])
    .executeTakeFirstOrThrow();
}

export async function doMes(tx: Tx) {
  return tx
    .selectFrom("ia.uso as x")
    .select([
      n(sql`sum(x.custo_usd)`).as("custo_usd"),
      n(sql`sum(x.tokens_contados)`).as("tokens"),
    ])
    .where("x.criado_em", ">=", INICIO_DO_MES)
    .executeTakeFirstOrThrow();
}

const SOMAS = [
  n(sql`count(*) filter (where ${PERGUNTA})`).as("perguntas"),
  n(sql`sum(x.tokens_contados)`).as("tokens"),
  n(sql`sum(x.custo_usd)`).as("custo_usd"),
] as const;

export async function porDia(tx: Tx, de: string, ate: string) {
  const r = await sql<{
    dia: string;
    perguntas: number;
    tokens: number;
    custo_usd: number;
  }>`
    select d::date::text as dia,
      coalesce(count(x.id) filter (where x.status <> 'limite'), 0)::float8 as perguntas,
      coalesce(sum(x.tokens_contados), 0)::float8 as tokens,
      coalesce(sum(x.custo_usd), 0)::float8 as custo_usd
    from generate_series(${de}::date, ${ate}::date, interval '1 day') as d
    left join ia.uso x
      on (x.criado_em at time zone ${FUSO})::date = d::date
    group by d
    order by d
  `.execute(tx);
  return r.rows;
}

export async function porHora(tx: Tx, de: string, ate: string) {
  return noPeriodo(tx, de, ate)
    .select([
      sql<number>`extract(hour from x.criado_em at time zone ${FUSO})::int`.as(
        "hora",
      ),
      n(sql`count(*)`).as("perguntas"),
    ])
    .where(PERGUNTA)
    .groupBy(sql`1`)
    .orderBy(sql`1`)
    .execute();
}

export async function porUsuario(tx: Tx, de: string, ate: string) {
  return noPeriodo(tx, de, ate)
    .innerJoin("core.usuarios as u", "u.id", "x.usuario_id")
    .leftJoin("core.cargos as c", "c.id", "u.cargo_id")
    .select([
      "u.id",
      "u.nome",
      "c.nome as cargo",
      ...SOMAS,
      sql<string>`max(x.criado_em)`.as("ultima"),
    ])
    .groupBy(["u.id", "u.nome", "c.nome"])
    .orderBy(sql`sum(x.custo_usd)`, "desc")
    .execute();
}

export async function porCargo(tx: Tx, de: string, ate: string) {
  return noPeriodo(tx, de, ate)
    .leftJoin("core.cargos as c", "c.id", "x.cargo_id")
    .select([
      "x.cargo_id as id",
      sql<string>`coalesce(c.nome, 'Sem cargo')`.as("nome"),
      ...SOMAS,
    ])
    .groupBy(["x.cargo_id", "c.nome"])
    .orderBy(sql`sum(x.custo_usd)`, "desc")
    .execute();
}

export async function porModulo(tx: Tx, de: string, ate: string) {
  const r = await sql<{ modulo: string; consultas: number; perguntas: number }>`
    select m as modulo,
      count(*)::float8 as consultas,
      count(distinct x.id)::float8 as perguntas
    from ia.uso x, unnest(x.modulos) as m
    where x.criado_em >= (${de}::date)::timestamp at time zone ${FUSO}
      and x.criado_em < (${ate}::date + 1)::timestamp at time zone ${FUSO}
    group by m
    order by 2 desc
  `.execute(tx);
  return r.rows;
}

export async function porModelo(tx: Tx, de: string, ate: string) {
  return noPeriodo(tx, de, ate)
    .select(["x.modelo", ...SOMAS])
    .where("x.modelo", "<>", "")
    .groupBy("x.modelo")
    .orderBy(sql`sum(x.custo_usd)`, "desc")
    .execute();
}

export async function porStatus(tx: Tx, de: string, ate: string) {
  return noPeriodo(tx, de, ate)
    .select(["x.status", n(sql`count(*)`).as("perguntas")])
    .groupBy("x.status")
    .orderBy(sql`2`, "desc")
    .execute();
}

/** Quem já conversou com a IA (para o filtro da tela de conversas). */
export function pessoasComConversa(tx: Tx) {
  return tx
    .selectFrom("core.usuarios as u")
    .select(["u.id", "u.nome"])
    .where((eb) =>
      eb.exists(
        eb
          .selectFrom("ia.conversas as c")
          .select("c.id")
          .whereRef("c.usuario_id", "=", "u.id"),
      ),
    )
    .orderBy("u.nome")
    .execute();
}

export async function perguntasPorConversa(
  tx: Tx,
  ids: string[],
): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const r = await tx
    .selectFrom("ia.perguntas")
    .select(["conversa_id", sql<number>`count(*)::int`.as("n")])
    .where("conversa_id", "in", ids)
    .groupBy("conversa_id")
    .execute();
  return new Map(r.map((l) => [l.conversa_id, l.n]));
}

export async function nomeDe(tx: Tx, usuarioId: string) {
  const r = await tx
    .selectFrom("core.usuarios")
    .select("nome")
    .where("id", "=", usuarioId)
    .executeTakeFirst();
  return r?.nome;
}
