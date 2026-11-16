import type { Insertable, Updateable } from "kysely";
import type { Tx } from "@/infra/banco";
import type { DB } from "@/infra/banco/tipos";

// Propostas de evento (comercial.propostas_evento), com a sessão: o RLS
// libera a leitura a quem vê ou edita eventos e a gravação só a quem edita.

/** Das mais novas para as mais antigas. */
export function propostas(tx: Tx) {
  return tx
    .selectFrom("comercial.propostas_evento")
    .select([
      "id",
      "criado_em",
      "cliente",
      "data_evento",
      "data_evento_fim",
      "area_m2",
      "valor_final",
      "status",
      "validade",
      "oportunidade_rd",
      "exemplo",
    ])
    .orderBy("criado_em", "desc")
    .orderBy("id")
    .execute();
}

export function proposta(tx: Tx, id: string) {
  return tx
    .selectFrom("comercial.propostas_evento")
    .select([
      "id",
      "criado_em",
      "atualizado_em",
      "cliente",
      "oportunidade_rd",
      "data_evento",
      "data_evento_fim",
      "horario",
      "tipo_data",
      "area_m2",
      "dias",
      "pessoas",
      "desconto_pct",
      "desconto_primeira_edicao",
      "valor_original",
      "valor_parceria",
      "valor_final",
      "segurancas",
      "agentes_limpeza",
      "condicao_pagamento",
      "montagem",
      "desmontagem",
      "fechamento_ate",
      "area_evento",
      "notas",
      "observacoes",
      "validade",
      "status",
      "exemplo",
    ])
    .where("id", "=", id)
    .executeTakeFirst();
}

export type LinhaProposta = Insertable<DB["comercial.propostas_evento"]>;

export function incluir(tx: Tx, linha: LinhaProposta) {
  return tx
    .insertInto("comercial.propostas_evento")
    .values(linha)
    .returning("id")
    .executeTakeFirstOrThrow();
}

export function alterar(
  tx: Tx,
  id: string,
  linha: Updateable<DB["comercial.propostas_evento"]>,
) {
  return tx
    .updateTable("comercial.propostas_evento")
    .set(linha)
    .where("id", "=", id)
    .returning("id")
    .execute();
}
