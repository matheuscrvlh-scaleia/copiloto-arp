import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Consultas do Painel de indicadores e das metas.

/** Fotos de ocupação do ano (RLS: comercial.painel.ver). */
export function fotosDoAno(tx: Tx, ano: number) {
  return tx
    .selectFrom("comercial.ocupacao_fotos")
    .select(["mes", "abl_total", "abl_locada", "clientes_ativos"])
    .where("mes", ">=", `${ano}-01-01`)
    .where("mes", "<=", `${ano}-12-01`)
    .execute();
}

/** Aluguel e condições dos contratos feitos no assistente (nada do locatário). */
export function carencias(tx: Tx) {
  return tx
    .selectFrom("comercial.contratos")
    .select([
      "id",
      "aluguel",
      sql<unknown>`dados -> 'condicoes'`.as("condicoes"),
    ])
    .where("tipo", "=", "contrato")
    .where("status", "<>", "rascunho")
    .orderBy("id")
    .execute();
}

export function metasDoAno(tx: Tx, de: string, ate: string) {
  return tx
    .selectFrom("core.metas")
    .select(["id", "indicador", "vigente_desde", "meta"])
    .where("indicador", "like", "comercial.%")
    .where("vigente_desde", ">=", de)
    .where("vigente_desde", "<=", ate)
    .execute();
}

export async function gravarMetas(
  tx: Tx,
  metas: {
    indicador: string;
    vigente_desde: string;
    meta: number;
    direcao: "maior_melhor" | "menor_melhor";
  }[],
) {
  if (!metas.length) return;
  await tx
    .insertInto("core.metas")
    .values(metas)
    .onConflict((oc) =>
      oc.columns(["indicador", "vigente_desde"]).doUpdateSet((eb) => ({
        meta: eb.ref("excluded.meta"),
        direcao: eb.ref("excluded.direcao"),
      })),
    )
    .execute();
}

export async function apagarMetas(tx: Tx, ids: string[]) {
  if (!ids.length) return;
  await tx
    .deleteFrom("core.metas")
    .where("id", "in", ids)
    .where("indicador", "like", "comercial.%")
    .execute();
}
