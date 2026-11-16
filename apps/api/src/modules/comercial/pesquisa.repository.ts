import type { Insertable, Updateable } from "kysely";
import type { Tx } from "@/infra/banco";
import type { DB } from "@/infra/banco/tipos";

// Pesquisa de mercado (comercial.pesquisa_imoveis). O RLS libera a leitura a
// quem vê ou edita a pesquisa e a gravação só a quem edita.

const COLUNAS = [
  "id",
  "data_pesquisa",
  "cep",
  "endereco",
  "bairro",
  "tipo",
  "area_m2",
  "aluguel",
  "condominio",
  "iptu",
  "vagas",
  "observacao",
  "fonte",
  "valor_m2",
  "custo_total",
  "custo_m2",
  "exemplo",
  "criado_em",
  "importacao_id",
] as const;

/** Do mais recente para o mais antigo. */
export function imoveis(tx: Tx) {
  return tx
    .selectFrom("comercial.pesquisa_imoveis")
    .select(COLUNAS)
    .orderBy("data_pesquisa", "desc")
    .orderBy("id")
    .execute();
}

export function imovel(tx: Tx, id: string) {
  return tx
    .selectFrom("comercial.pesquisa_imoveis")
    .select(COLUNAS)
    .where("id", "=", id)
    .executeTakeFirst();
}

export type LinhaImovel = Insertable<DB["comercial.pesquisa_imoveis"]>;

export function incluir(tx: Tx, linha: LinhaImovel) {
  return tx
    .insertInto("comercial.pesquisa_imoveis")
    .values(linha)
    .returning("id")
    .executeTakeFirstOrThrow();
}

export function alterar(
  tx: Tx,
  id: string,
  linha: Updateable<DB["comercial.pesquisa_imoveis"]>,
) {
  return tx
    .updateTable("comercial.pesquisa_imoveis")
    .set(linha)
    .where("id", "=", id)
    .returning("id")
    .execute();
}

/** O que já está na pesquisa (para os repetidos da importação). */
export function existentes(tx: Tx) {
  return tx
    .selectFrom("comercial.pesquisa_imoveis")
    .select([
      "id",
      "data_pesquisa",
      "endereco",
      "area_m2",
      "aluguel",
      "importacao_id",
    ])
    .orderBy("id")
    .execute();
}

export function incluirVarios(tx: Tx, linhas: LinhaImovel[]) {
  return tx
    .insertInto("comercial.pesquisa_imoveis")
    .values(linhas)
    .returning("id")
    .execute();
}
