import type { Tx } from "@/infra/banco";

// Opções de "quem vê" e do responsável: setores ativos, cargos ativos e
// todas as pessoas (as inativas só para mostrar o nome em itens antigos).

export function setores(tx: Tx) {
  return tx
    .selectFrom("os.setores")
    .select(["id", "nome", "cor"])
    .where("ativo", "=", true)
    .orderBy("ordem")
    .orderBy("nome")
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

export function pessoas(tx: Tx) {
  return tx
    .selectFrom("core.usuarios")
    .select(["id", "nome", "ativo"])
    .orderBy("nome")
    .execute();
}
