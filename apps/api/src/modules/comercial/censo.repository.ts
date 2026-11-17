import type { RespostaQuestionario } from "@arp/shared/comercial/censo";
import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Censo (comercial.censo_*). Rodadas, respostas, temas e contatos de
// feedback são lidos com a sessão (RLS). O link público lê pela service role
// só depois de conferir o formato do token, e só o convite daquele token.

export function rodadas(tx: Tx) {
  return tx
    .selectFrom("comercial.censo_rodadas")
    .select([
      "id",
      "nome",
      "inicio",
      "fim",
      "situacao",
      "exemplo",
      "importacao_id",
      "encerrada_em",
    ])
    .orderBy("inicio", "desc")
    .orderBy("id")
    .execute();
}

/** Respostas que contam (sem as repetidas) das rodadas, para os indicadores. */
export function respostasDosIndicadores(tx: Tx, rodadas: string[]) {
  return tx
    .selectFrom("comercial.censo_respostas")
    .select([
      "id",
      "rodada_id",
      "bloco",
      "segmento",
      "colaboradores",
      "visitantes_dia",
      "ticket_ajustado",
      "conversoes_dia",
      "expectativas",
    ])
    .where("rodada_id", "in", rodadas)
    .where("considerada", "=", true)
    .orderBy("id")
    .execute();
}

const COLUNAS_RESPOSTA = [
  "id",
  "rodada_id",
  "convite_id",
  "email",
  "bloco",
  "segmento",
  "empresa_nome",
  "colaboradores",
  "visitantes_dia",
  "ticket",
  "mensalidade",
  "dias_uso",
  "conversoes_dia",
  "expectativas",
  "sugestao",
  "ticket_ajustado",
  "considerada",
  "origem",
  "respondida_em",
  "lancada_por",
  "locatario_enet_id",
  "exemplo",
] as const;

/** Todas as respostas de uma rodada (aba Rodadas e Feedbacks). */
export function respostasDaRodada(tx: Tx, rodada: string) {
  return tx
    .selectFrom("comercial.censo_respostas")
    .select(COLUNAS_RESPOSTA)
    .where("rodada_id", "=", rodada)
    .orderBy("respondida_em", "desc")
    .orderBy("id")
    .execute();
}

/** Convites da rodada (só quem aplica o Censo: o RLS esconde dos outros). */
export function convitesDaRodada(tx: Tx, rodada: string) {
  return tx
    .selectFrom("comercial.censo_convites")
    .select([
      "id",
      "token",
      "empresa_nome",
      "luc",
      "bloco",
      "enviado_em",
      "locatario_enet_id",
    ])
    .where("rodada_id", "=", rodada)
    .orderBy("empresa_nome")
    .orderBy("id")
    .execute();
}

export function contarConvites(tx: Tx) {
  return tx
    .selectFrom("comercial.censo_convites")
    .select(["rodada_id", sql<number>`count(*)::int`.as("n")])
    .groupBy("rodada_id")
    .execute();
}

export function contarRespostas(tx: Tx) {
  return tx
    .selectFrom("comercial.censo_respostas")
    .select(["rodada_id", sql<number>`count(*)::int`.as("n")])
    .where("considerada", "=", true)
    .groupBy("rodada_id")
    .execute();
}

export function temas(tx: Tx) {
  return tx
    .selectFrom("comercial.censo_temas")
    .select(["id", "nome", "ordem", "ativo"])
    .orderBy("ordem")
    .orderBy("nome")
    .execute();
}

const COLUNAS_VINCULO = [
  "id",
  "tema_id",
  "resposta_id",
  "contato_id",
  "trecho",
  "origem",
  "movido_por",
  "movido_em",
] as const;

export function vinculosDasRespostas(tx: Tx, ids: string[]) {
  return tx
    .selectFrom("comercial.censo_sugestao_temas")
    .select(COLUNAS_VINCULO)
    .where("resposta_id", "in", ids)
    .execute();
}

export function vinculosDosContatos(tx: Tx, ids: string[]) {
  return tx
    .selectFrom("comercial.censo_sugestao_temas")
    .select(COLUNAS_VINCULO)
    .where("contato_id", "in", ids)
    .execute();
}

/** Registros de contato de feedback no período (de exclusivo, até inclusivo). */
export function contatosDeFeedback(
  tx: Tx,
  tipos: string[],
  de: string | null,
  ate: string,
) {
  let q = tx
    .selectFrom("comercial.contatos")
    .select([
      "id",
      "data",
      "locatario_enet_id",
      "locatario_nome",
      "bloco",
      "tipo",
      "descricao",
    ])
    .where("tipo", "in", tipos)
    .where("data", "<=", ate);
  if (de) q = q.where("data", ">", de);
  return q.orderBy("data", "desc").orderBy("id").execute();
}

// ---------------------------------------------------------------------------
// Questionário
// ---------------------------------------------------------------------------

export function listasDoQuestionario(tx: Tx) {
  return tx
    .selectFrom("comercial.listas")
    .select(["lista", "valor"])
    .where("lista", "in", [
      "censo_bloco",
      "censo_segmento",
      "censo_expectativa",
    ])
    .where("ativo", "=", true)
    .orderBy("ordem")
    .orderBy("valor")
    .execute();
}

export function diasDaMensalidade(tx: Tx) {
  return tx
    .selectFrom("comercial.parametros")
    .select("censo_dias_mensalidade")
    .where("id", "=", true)
    .executeTakeFirstOrThrow();
}

export function convite(tx: Tx, filtro: { token: string } | { id: string }) {
  let q = tx
    .selectFrom("comercial.censo_convites as c")
    .innerJoin("comercial.censo_rodadas as r", "r.id", "c.rodada_id")
    .select([
      "c.id",
      "c.rodada_id",
      "c.token",
      "c.empresa_nome",
      "c.luc",
      "c.bloco",
      "c.locatario_enet_id",
      "c.exemplo",
      "r.nome as rodada_nome",
      "r.inicio as rodada_inicio",
      "r.fim as rodada_fim",
      "r.situacao as rodada_situacao",
    ]);
  q =
    "token" in filtro
      ? q.where("c.token", "=", filtro.token)
      : q.where("c.id", "=", filtro.id);
  return q.executeTakeFirst();
}

/** Confere pelo RLS que a pessoa vê o convite (antes da service role). */
export function conviteVisivel(tx: Tx, id: string) {
  return tx
    .selectFrom("comercial.censo_convites")
    .select("id")
    .where("id", "=", id)
    .executeTakeFirst();
}

export function respostaDoConvite(tx: Tx, convite: string) {
  return tx
    .selectFrom("comercial.censo_respostas")
    .select(COLUNAS_RESPOSTA)
    .where("convite_id", "=", convite)
    .executeTakeFirst();
}

export type LinhaResposta = RespostaQuestionario & {
  rodada_id: string;
  convite_id: string;
  locatario_enet_id: string | null;
  luc: string | null;
};

export function corrigirResposta(tx: Tx, id: string, linha: LinhaResposta) {
  return tx
    .updateTable("comercial.censo_respostas")
    .set({ ...linha, respondida_em: sql<string>`now()` })
    .where("id", "=", id)
    .execute();
}

export function incluirResposta(
  tx: Tx,
  linha: LinhaResposta & {
    origem: string;
    exemplo: boolean;
    lancada_por: string | null;
  },
) {
  return tx.insertInto("comercial.censo_respostas").values(linha).execute();
}

// ---------------------------------------------------------------------------
// Rodadas e convites
// ---------------------------------------------------------------------------

export function incluirRodada(
  tx: Tx,
  r: { nome: string; inicio: string; fim: string },
) {
  return tx
    .insertInto("comercial.censo_rodadas")
    .values(r)
    .returning("id")
    .executeTakeFirstOrThrow();
}

export function incluirConvites(
  tx: Tx,
  convites: {
    rodada_id: string;
    locatario_enet_id: string;
    empresa_nome: string;
    luc: string | null;
    bloco: string | null;
    exemplo: boolean;
  }[],
) {
  return tx
    .insertInto("comercial.censo_convites")
    .values(convites)
    .onConflict((oc) =>
      oc.columns(["rodada_id", "locatario_enet_id"]).doNothing(),
    )
    .returning("id")
    .execute();
}

export function encerrarRodada(tx: Tx, id: string, usuario: string) {
  return tx
    .updateTable("comercial.censo_rodadas")
    .set({
      situacao: "encerrada",
      encerrada_por: usuario,
      encerrada_em: sql<string>`now()`,
    })
    .where("id", "=", id)
    .where("situacao", "=", "aberta")
    .returning("nome")
    .execute();
}

/** Situação da rodada e quantas respostas ela já tem. */
export async function rodadaParaAlterar(tx: Tx, id: string) {
  const r = await tx
    .selectFrom("comercial.censo_rodadas")
    .select(["nome", "situacao"])
    .where("id", "=", id)
    .executeTakeFirst();
  if (!r) return null;
  const { n } = await tx
    .selectFrom("comercial.censo_respostas")
    .select((eb) => eb.fn.countAll<string>().as("n"))
    .where("rodada_id", "=", id)
    .executeTakeFirstOrThrow();
  return { ...r, respostas: Number(n) };
}

export function alterarRodada(
  tx: Tx,
  id: string,
  d: { nome: string; inicio: string; fim: string },
) {
  return tx
    .updateTable("comercial.censo_rodadas")
    .set(d)
    .where("id", "=", id)
    .returning("id")
    .execute();
}

/** O RLS só deixa excluir com respostas a quem tem comercial.censo.aprovar. */
export function excluirRodada(tx: Tx, id: string) {
  return tx
    .deleteFrom("comercial.censo_rodadas")
    .where("id", "=", id)
    .returning("nome")
    .execute();
}

export function marcarEnviado(tx: Tx, id: string) {
  return tx
    .updateTable("comercial.censo_convites")
    .set({ enviado_em: sql<string>`now()` })
    .where("id", "=", id)
    .where("enviado_em", "is", null)
    .execute();
}

// ---------------------------------------------------------------------------
// Temas
// ---------------------------------------------------------------------------

export function apagarVinculo(tx: Tx, id: string) {
  return tx
    .deleteFrom("comercial.censo_sugestao_temas")
    .where("id", "=", id)
    .execute();
}

export function vinculoNoTema(
  tx: Tx,
  coluna: "resposta_id" | "contato_id",
  alvo: string,
  tema: string,
) {
  return tx
    .selectFrom("comercial.censo_sugestao_temas")
    .select("id")
    .where(coluna, "=", alvo)
    .where("tema_id", "=", tema)
    .executeTakeFirst();
}

export function mudarTema(tx: Tx, vinculo: string, tema: string) {
  return tx
    .updateTable("comercial.censo_sugestao_temas")
    .set({ tema_id: tema })
    .where("id", "=", vinculo)
    .execute();
}

export function incluirVinculo(
  tx: Tx,
  v: {
    resposta_id?: string;
    contato_id?: string;
    tema_id: string;
    movido_por: string;
  },
) {
  return tx
    .insertInto("comercial.censo_sugestao_temas")
    .values({ ...v, origem: "manual", movido_em: sql<string>`now()` })
    .execute();
}

export function alterarTema(
  tx: Tx,
  id: string,
  t: { nome: string; ativo: boolean },
) {
  return tx
    .updateTable("comercial.censo_temas")
    .set(t)
    .where("id", "=", id)
    .execute();
}

export function incluirTema(tx: Tx, t: { nome: string; ativo: boolean }) {
  return tx
    .insertInto("comercial.censo_temas")
    .values(t)
    .returning("id")
    .executeTakeFirstOrThrow();
}

// ---------------------------------------------------------------------------
// Importação (service role, depois de comercial.censo.importar)
// ---------------------------------------------------------------------------

export function rodadaComNome(tx: Tx, nome: string) {
  return tx
    .selectFrom("comercial.censo_rodadas")
    .select(["id", "exemplo"])
    .where("nome", "ilike", nome)
    .executeTakeFirst();
}

export function apagarRodada(tx: Tx, id: string) {
  return tx
    .deleteFrom("comercial.censo_rodadas")
    .where("id", "=", id)
    .execute();
}

export function incluirRodadaImportada(
  tx: Tx,
  r: {
    nome: string;
    inicio: string;
    fim: string;
    criada_por: string;
    importacao_id: string;
  },
) {
  return tx
    .insertInto("comercial.censo_rodadas")
    .values({
      ...r,
      situacao: "encerrada",
      encerrada_por: r.criada_por,
      encerrada_em: sql<string>`now()`,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
}

export function incluirRespostasImportadas(
  tx: Tx,
  linhas: {
    rodada_id: string;
    email: string | null;
    bloco: string | null;
    segmento: string | null;
    empresa_nome: string;
    colaboradores: number | null;
    visitantes_dia: number | null;
    ticket: number | null;
    mensalidade: boolean | null;
    dias_uso: number | null;
    conversoes_dia: number | null;
    expectativas: string[];
    sugestao: string | null;
    ticket_ajustado: number | null;
    considerada: boolean;
    origem: string;
    respondida_em: string;
    importacao_id: string;
  }[],
) {
  return tx.insertInto("comercial.censo_respostas").values(linhas).execute();
}
