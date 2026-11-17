import type { Insertable, Updateable } from "kysely";
import type { Tx } from "@/infra/banco";
import type { DB } from "@/infra/banco/tipos";

// Kit de entrega (comercial.kit_documentos e kit_versoes). Com a sessão, o
// RLS libera a leitura a quem vê o kit ou monta contrato e a gravação a quem
// edita o kit; o gatilho do banco tira a versão anterior do kit.

const DOCUMENTO = [
  "id",
  "nome",
  "categoria",
  "ordem",
  "blocos",
  "lucs",
  "todo_contrato",
  "ativo",
] as const;

const VERSAO = [
  "id",
  "documento_id",
  "versao",
  "data",
  "validade",
  "paginas",
  "arquivo_nome",
  "arquivo_path",
  "tamanho",
  "atual",
  "enviado_por",
  "enviado_em",
] as const;

export function documentos(tx: Tx) {
  return tx
    .selectFrom("comercial.kit_documentos")
    .select(DOCUMENTO)
    .orderBy("ordem")
    .orderBy("nome")
    .execute();
}

export function versoesAtuais(tx: Tx) {
  return tx
    .selectFrom("comercial.kit_versoes")
    .select(VERSAO)
    .where("atual", "=", true)
    .execute();
}

export function documento(tx: Tx, id: string) {
  return tx
    .selectFrom("comercial.kit_documentos")
    .select(DOCUMENTO)
    .where("id", "=", id)
    .executeTakeFirst();
}

/** Da mais nova para a mais antiga. */
export function versoesDoDocumento(tx: Tx, id: string) {
  return tx
    .selectFrom("comercial.kit_versoes")
    .select(VERSAO)
    .where("documento_id", "=", id)
    .orderBy("enviado_em", "desc")
    .execute();
}

export function arquivoDaVersao(tx: Tx, id: string) {
  return tx
    .selectFrom("comercial.kit_versoes")
    .select(["arquivo_path", "arquivo_nome"])
    .where("id", "=", id)
    .executeTakeFirst();
}

export function caminhosDasVersoes(tx: Tx, ids: string[]) {
  return tx
    .selectFrom("comercial.kit_versoes")
    .select(["id", "arquivo_path"])
    .where("id", "in", ids)
    .execute();
}

export function ultimaOrdem(tx: Tx) {
  return tx
    .selectFrom("comercial.kit_documentos")
    .select("ordem")
    .orderBy("ordem", "desc")
    .limit(1)
    .executeTakeFirst();
}

export function incluirDocumento(
  tx: Tx,
  d: Insertable<DB["comercial.kit_documentos"]>,
) {
  return tx
    .insertInto("comercial.kit_documentos")
    .values(d)
    .returning("id")
    .executeTakeFirstOrThrow();
}

export function incluirVersao(
  tx: Tx,
  v: Insertable<DB["comercial.kit_versoes"]>,
) {
  return tx
    .insertInto("comercial.kit_versoes")
    .values(v)
    .returning("id")
    .executeTakeFirstOrThrow();
}

/** Caminho que já é de alguma versão (service role). */
export function caminhoEmUso(tx: Tx, path: string) {
  return tx
    .selectFrom("comercial.kit_versoes")
    .select("id")
    .where("arquivo_path", "=", path)
    .limit(1)
    .executeTakeFirst();
}

/** Arquivo na versão que ainda não tinha. */
export function completarVersao(
  tx: Tx,
  versaoId: string,
  documentoId: string,
  arquivo: { arquivo_path: string; arquivo_nome: string; tamanho: number },
) {
  return tx
    .updateTable("comercial.kit_versoes")
    .set(arquivo)
    .where("id", "=", versaoId)
    .where("documento_id", "=", documentoId)
    .where("arquivo_path", "is", null)
    .returning("id")
    .execute();
}

export function alterarDocumento(
  tx: Tx,
  id: string,
  d: Updateable<DB["comercial.kit_documentos"]>,
) {
  return tx
    .updateTable("comercial.kit_documentos")
    .set(d)
    .where("id", "=", id)
    .returning("id")
    .execute();
}

export function alterarValidade(
  tx: Tx,
  versaoId: string,
  documentoId: string,
  validade: string | null,
) {
  return tx
    .updateTable("comercial.kit_versoes")
    .set({ validade })
    .where("id", "=", versaoId)
    .where("documento_id", "=", documentoId)
    .where("atual", "=", true)
    .execute();
}
