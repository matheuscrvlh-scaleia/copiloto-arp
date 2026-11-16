import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Histórico das Configurações do Marketing (core.auditoria) e o nome de
// quem alterou.

const COLUNAS = [
  "id",
  "tabela",
  "registro_id",
  "acao",
  "antes",
  "depois",
  "usuario_id",
  "em",
] as const;

/** Alterações dos cadastros `tabelas`, da mais nova para a mais antiga. */
export function alteracoesDosCadastros(
  tx: Tx,
  tabelas: string[],
  limite: number,
) {
  return tx
    .selectFrom("core.auditoria")
    .select(COLUNAS)
    .where("tabela", "in", tabelas)
    .orderBy("em", "desc")
    .orderBy("id", "desc")
    .limit(limite)
    .execute();
}

/** Alterações das metas marketing.* de core.metas. */
export function alteracoesDasMetas(tx: Tx, limite: number) {
  return tx
    .selectFrom("core.auditoria")
    .select(COLUNAS)
    .where("tabela", "=", "core.metas")
    .where((eb) =>
      eb.or([
        eb(sql<string>`depois->>'indicador'`, "like", "marketing.%"),
        eb(sql<string>`antes->>'indicador'`, "like", "marketing.%"),
      ]),
    )
    .orderBy("em", "desc")
    .orderBy("id", "desc")
    .limit(limite)
    .execute();
}

export function alteracao(tx: Tx, id: number) {
  return tx
    .selectFrom("core.auditoria")
    .select(COLUNAS)
    .where("id", "=", id)
    .executeTakeFirst();
}

export function nomes(tx: Tx, ids: string[]) {
  return tx
    .selectFrom("core.usuarios")
    .select(["id", "nome"])
    .where("id", "in", ids)
    .execute();
}
