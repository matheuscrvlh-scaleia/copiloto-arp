import type { Tx } from "@/infra/banco";

// Respostas dos formulários (formularios.respostas). Com a sessão: o RLS
// libera ler a quem vê os formulários e excluir a quem edita. Ao excluir,
// o gatilho do banco desconta o total do formulário.

const COLUNAS = ["id", "enviada_em", "respostas", "perguntas"] as const;

/** Todas as respostas, das mais recentes para as mais antigas. */
export function doFormulario(tx: Tx, formularioId: string) {
  return tx
    .selectFrom("formularios.respostas")
    .select(COLUNAS)
    .where("formulario_id", "=", formularioId)
    .orderBy("enviada_em", "desc")
    .orderBy("id")
    .execute();
}

export function porId(tx: Tx, formularioId: string, id: string) {
  return tx
    .selectFrom("formularios.respostas")
    .select(COLUNAS)
    .where("formulario_id", "=", formularioId)
    .where("id", "=", id)
    .executeTakeFirst();
}

/** As respostas apagadas (vazio: não existia ou o RLS não deixou). */
export function excluir(tx: Tx, formularioId: string, id: string) {
  return tx
    .deleteFrom("formularios.respostas")
    .where("formulario_id", "=", formularioId)
    .where("id", "=", id)
    .returning(["id", "respostas"])
    .execute();
}
