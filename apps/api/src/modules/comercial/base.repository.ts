import type { Tx } from "@/infra/banco";

// Consultas da configuração do Comercial (igual para todos do módulo).

export function parametros(tx: Tx) {
  return tx
    .selectFrom("comercial.parametros")
    .selectAll()
    .where("id", "=", true)
    .executeTakeFirstOrThrow();
}

/** Todas as listas (ativas e inativas), por lista e ordem. */
export function listas(tx: Tx) {
  return tx
    .selectFrom("comercial.listas")
    .selectAll()
    .orderBy("lista")
    .orderBy("ordem")
    .orderBy("valor")
    .execute();
}

export function fontesDePara(tx: Tx) {
  return tx
    .selectFrom("comercial.fontes_de_para")
    .selectAll()
    .orderBy("fonte_rd")
    .execute();
}

export function tiposLuc(tx: Tx) {
  return tx
    .selectFrom("comercial.tipos_luc")
    .selectAll()
    .orderBy("ordem")
    .orderBy("tipo")
    .execute();
}

export function faixasEvento(tx: Tx) {
  return tx
    .selectFrom("comercial.faixas_evento")
    .selectAll()
    .orderBy("ordem")
    .execute();
}

export function metas(tx: Tx) {
  return tx
    .selectFrom("core.metas")
    .select([
      "id",
      "indicador",
      "direcao",
      "meta",
      "limite_atencao",
      "vigente_desde",
    ])
    .where("indicador", "like", "comercial.%")
    .orderBy("vigente_desde")
    .execute();
}

/** Nome das pessoas pelo id (o RLS de core.usuarios vale no escopo). */
export function nomesDeUsuarios(tx: Tx, ids: string[]) {
  return tx
    .selectFrom("core.usuarios")
    .select(["id", "nome"])
    .where("id", "in", ids)
    .execute();
}
