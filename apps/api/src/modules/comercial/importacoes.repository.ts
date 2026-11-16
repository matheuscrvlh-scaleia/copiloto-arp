import type { FeedbackLido } from "@arp/shared/comercial/feedbacks-importacao";
import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Consultas das importações do histórico (comercial.importacoes). Tudo com a
// sessão: o RLS confere a permissão do tipo (comercial.pode_importar).

export async function podeImportar(tx: Tx, tipo: string): Promise<boolean> {
  const r = await sql<{
    pode: boolean;
  }>`select comercial.pode_importar(p_tipo => ${tipo}) as pode`.execute(tx);
  return r.rows[0]?.pode === true;
}

export function confirmadaComMesmoArquivo(tx: Tx, tipo: string, hash: string) {
  return tx
    .selectFrom("comercial.importacoes")
    .select(["id", "confirmado_em", "confirmado_por", "linhas"])
    .where("tipo", "=", tipo)
    .where("arquivo_sha256", "=", hash)
    .where("status", "=", "confirmada")
    .executeTakeFirst();
}

export function incluir(
  tx: Tx,
  i: {
    id: string;
    tipo: string;
    arquivo_nome: string;
    arquivo_path: string;
    arquivo_sha256: string;
    linhas: number;
    duplicadas: number;
    com_aviso: number;
    avisos: string;
    enviado_por: string;
  },
) {
  return tx.insertInto("comercial.importacoes").values(i).execute();
}

export function importacao(tx: Tx, id: string) {
  return tx
    .selectFrom("comercial.importacoes")
    .select([
      "id",
      "tipo",
      "status",
      "arquivo_path",
      "arquivo_nome",
      "arquivo_sha256",
    ])
    .where("id", "=", id)
    .executeTakeFirst();
}

/** Reserva a prévia: um segundo clique (ou outra aba) não grava de novo. */
export function reservar(tx: Tx, id: string) {
  return tx
    .updateTable("comercial.importacoes")
    .set({ status: "confirmando" })
    .where("id", "=", id)
    .where("status", "=", "previa")
    .returning("id")
    .executeTakeFirst();
}

export async function desfazer(tx: Tx, id: string): Promise<number> {
  const r = await sql<{
    apagadas: number | null;
  }>`select comercial.desfazer_importacao(p_id => ${id}) as apagadas`.execute(
    tx,
  );
  return Number(r.rows[0]?.apagadas ?? 0);
}

export function confirmar(
  tx: Tx,
  id: string,
  c: {
    linhas: number;
    duplicadas: number;
    com_aviso: number;
    confirmado_por: string;
  },
) {
  return tx
    .updateTable("comercial.importacoes")
    .set({ ...c, status: "confirmada", confirmado_em: sql`now()` })
    .where("id", "=", id)
    .where("status", "=", "confirmando")
    .returning("id")
    .executeTakeFirst();
}

export const LIMITE_IMPORTACOES = 100;

/** Confirmadas e desfeitas que a pessoa vê, da mais nova para a mais antiga. */
export function historico(tx: Tx) {
  return tx
    .selectFrom("comercial.importacoes")
    .select([
      "id",
      "tipo",
      "arquivo_nome",
      "status",
      "linhas",
      "duplicadas",
      "com_aviso",
      "enviado_por",
      "criado_em",
      "confirmado_por",
      "confirmado_em",
      "desfeito_por",
      "desfeito_em",
    ])
    .where("status", "in", ["confirmada", "desfeita"])
    .orderBy("criado_em", "desc")
    .limit(LIMITE_IMPORTACOES)
    .execute();
}

/** Prévias não confirmadas criadas antes do instante (limpeza da rotina). */
export function previasAbandonadas(tx: Tx, antes: string) {
  return tx
    .selectFrom("comercial.importacoes")
    .select(["id", "arquivo_path"])
    .where("status", "=", "previa")
    .where("criado_em", "<", antes)
    .limit(500)
    .execute();
}

export function apagarPrevias(tx: Tx, ids: string[]) {
  return tx
    .deleteFrom("comercial.importacoes")
    .where("id", "in", ids)
    .where("status", "=", "previa")
    .execute();
}

/** Contatos já registrados (repetidos dos Feedbacks), os mais recentes. */
export function contatosExistentes(tx: Tx) {
  return (
    tx
      .selectFrom("comercial.contatos")
      .select(["data", "locatario_nome", "descricao"])
      .orderBy("data", "desc")
      // atalho: confere repetidos só nos 5.000 contatos mais recentes
      .limit(5000)
      .execute()
  );
}

export function incluirContatos(
  tx: Tx,
  linhas: (FeedbackLido & { registrado_por: string; importacao_id: string })[],
) {
  return tx
    .insertInto("comercial.contatos")
    .values(linhas)
    .returning("id")
    .execute();
}
