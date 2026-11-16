import type { Tx } from "@/infra/banco";

// Consultas dos cadastros de Configurações do Marketing e das metas.

export function parametros(tx: Tx) {
  return tx
    .selectFrom("marketing.parametros")
    .selectAll()
    .where("id", "=", true)
    .executeTakeFirst();
}

export function locatarios(tx: Tx) {
  return tx
    .selectFrom("marketing.locatarios")
    .selectAll()
    .orderBy("nome")
    .execute();
}

export function landingPages(tx: Tx) {
  return tx
    .selectFrom("marketing.landing_pages")
    .selectAll()
    .orderBy("nome")
    .execute();
}

export function regrasAlerta(tx: Tx) {
  return tx.selectFrom("marketing.regras_alerta").selectAll().execute();
}

export function referencias(tx: Tx) {
  return tx
    .selectFrom("marketing.benchmark")
    .selectAll()
    .orderBy("nome")
    .execute();
}

export function temas(tx: Tx) {
  return tx
    .selectFrom("marketing.temas")
    .selectAll()
    .orderBy("ordem")
    .orderBy("nome")
    .execute();
}

export function codigosRonda(tx: Tx) {
  return tx
    .selectFrom("marketing.ronda_codigos")
    .selectAll()
    .orderBy("codigo")
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
    .where("indicador", "like", "marketing.%")
    .orderBy("vigente_desde")
    .execute();
}
