import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Consultas do assistente: configuração, limites, conversas e uso.

/** Começo do mês corrente no fuso de Brasília. */
export const INICIO_DO_MES = sql<string>`(date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')`;

export function config(tx: Tx) {
  return tx.selectFrom("ia.config").selectAll().executeTakeFirst();
}

/** Limite próprio e o do cargo (undefined: não definido naquele nível). */
export async function limitesDaPessoa(tx: Tx, usuarioId: string) {
  const proprio = await tx
    .selectFrom("ia.limites")
    .select("tokens_mes")
    .where("usuario_id", "=", usuarioId)
    .executeTakeFirst();
  const doCargo = await tx
    .selectFrom("ia.limites as l")
    .innerJoin("core.usuarios as u", "u.cargo_id", "l.cargo_id")
    .select("l.tokens_mes")
    .where("u.id", "=", usuarioId)
    .executeTakeFirst();
  return { usuario: proprio?.tokens_mes, cargo: doCargo?.tokens_mes };
}

export async function usoDoMes(tx: Tx, usuarioId: string) {
  const r = await tx
    .selectFrom("ia.uso")
    .select([
      sql<number>`coalesce(sum(tokens_contados) filter (where usuario_id = ${usuarioId}), 0)::float8`.as(
        "tokens",
      ),
      sql<number>`coalesce(sum(custo_usd), 0)::float8`.as("custo"),
    ])
    .where("criado_em", ">=", INICIO_DO_MES)
    .executeTakeFirstOrThrow();
  return { tokensDaPessoa: r.tokens, gastoTotal: r.custo };
}

export function conversas(tx: Tx) {
  return tx
    .selectFrom("ia.conversas")
    .select(["id", "titulo", "atualizada_em"])
    .orderBy("atualizada_em", "desc")
    .limit(60)
    .execute();
}

export function conversa(tx: Tx, id: string) {
  return tx
    .selectFrom("ia.conversas")
    .select(["id", "titulo"])
    .where("id", "=", id)
    .executeTakeFirst();
}

export function perguntas(tx: Tx, conversaId: string) {
  return tx
    .selectFrom("ia.perguntas")
    .select([
      "id",
      "pergunta",
      "resposta",
      "fontes",
      "status",
      "avaliacao",
      "criada_em",
    ])
    .where("conversa_id", "=", conversaId)
    .orderBy("criada_em")
    .orderBy("id")
    .execute();
}

/** O que a IA já trocou nesta conversa (só turnos que terminaram bem). */
export function historico(tx: Tx, conversaId: string) {
  return tx
    .selectFrom("ia.perguntas")
    .select("mensagens")
    .where("conversa_id", "=", conversaId)
    .where("status", "=", "ok")
    .orderBy("criada_em")
    .orderBy("id")
    .execute();
}

export async function criarConversa(tx: Tx, titulo: string): Promise<string> {
  const r = await tx
    .insertInto("ia.conversas")
    .values({ titulo })
    .returning("id")
    .executeTakeFirstOrThrow();
  return r.id;
}

export async function criarPergunta(
  tx: Tx,
  conversaId: string,
  pergunta: string,
): Promise<string> {
  const r = await tx
    .insertInto("ia.perguntas")
    .values({ conversa_id: conversaId, pergunta })
    .returning("id")
    .executeTakeFirstOrThrow();
  await tx
    .updateTable("ia.conversas")
    .set({ atualizada_em: sql`now()` })
    .where("id", "=", conversaId)
    .execute();
  return r.id;
}

export function concluirPergunta(
  tx: Tx,
  id: string,
  dados: {
    resposta: string;
    mensagens: unknown[];
    fontes: unknown[];
    status: string;
  },
) {
  return tx
    .updateTable("ia.perguntas")
    .set({
      resposta: dados.resposta,
      mensagens: JSON.stringify(dados.mensagens),
      fontes: JSON.stringify(dados.fontes),
      status: dados.status,
    })
    .where("id", "=", id)
    .execute();
}

export async function apagarConversa(tx: Tx, id: string): Promise<boolean> {
  const r = await tx
    .deleteFrom("ia.conversas")
    .where("id", "=", id)
    .executeTakeFirst();
  return r.numDeletedRows > 0n;
}

export async function avaliar(
  tx: Tx,
  perguntaId: string,
  avaliacao: number | null,
): Promise<boolean> {
  const r = await tx
    .updateTable("ia.perguntas")
    .set({ avaliacao })
    .where("id", "=", perguntaId)
    .executeTakeFirst();
  await tx
    .updateTable("ia.uso")
    .set({ avaliacao })
    .where("pergunta_id", "=", perguntaId)
    .execute();
  return r.numUpdatedRows > 0n;
}

export interface NovoUso {
  perguntaId: string | null;
  conversaId: string | null;
  usuarioId: string;
  modelo: string;
  entrada: number;
  saida: number;
  cacheEscrita: number;
  cacheLeitura: number;
  contados: number;
  custoUsd: number;
  consultas: number;
  modulos: string[];
  duracaoMs: number;
  status: string;
}

/** Service role: a pessoa não grava o próprio uso. Guarda o cargo de agora. */
export function registrarUso(tx: Tx, u: NovoUso) {
  return tx
    .insertInto("ia.uso")
    .values((eb) => ({
      pergunta_id: u.perguntaId,
      conversa_id: u.conversaId,
      usuario_id: u.usuarioId,
      cargo_id: eb
        .selectFrom("core.usuarios")
        .select("cargo_id")
        .where("id", "=", u.usuarioId),
      modelo: u.modelo,
      tokens_entrada: u.entrada,
      tokens_saida: u.saida,
      tokens_cache_escrita: u.cacheEscrita,
      tokens_cache_leitura: u.cacheLeitura,
      tokens_contados: u.contados,
      custo_usd: u.custoUsd,
      consultas: u.consultas,
      modulos: u.modulos,
      duracao_ms: u.duracaoMs,
      status: u.status,
    }))
    .execute();
}

/** Rotina diária: apaga as conversas paradas há mais de `dias` dias. */
export async function apagarConversasAntigas(tx: Tx): Promise<number> {
  const r = await tx
    .deleteFrom("ia.conversas")
    .where(
      "atualizada_em",
      "<",
      sql<string>`now() - make_interval(days => (select dias_de_guarda from ia.config))`,
    )
    .executeTakeFirst();
  return Number(r.numDeletedRows);
}
