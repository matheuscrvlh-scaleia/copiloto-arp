import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Consultas do que as sincronizações gravaram (redes, RD, estacionamento) e
// das câmeras.

/** Quando a última sincronização da Meta gravou a foto das redes. */
export function ultimaFotoDasRedes(tx: Tx) {
  return tx
    .selectFrom("marketing.redes_dia")
    .select("atualizado_em")
    .orderBy("atualizado_em", "desc")
    .limit(1)
    .executeTakeFirst();
}

export function redesDesde(tx: Tx, desde: string) {
  return tx
    .selectFrom("marketing.redes_dia")
    .select([
      "rede",
      "dia",
      "seguidores",
      "alcance",
      "visualizacoes",
      "interacoes",
      "contas_engajadas",
      "toques_links",
    ])
    .where("dia", ">=", desde)
    .orderBy("dia")
    .execute();
}

/** Quando a última sincronização do RD terminou bem. */
export function ultimaLeituraDoRd(tx: Tx) {
  return tx
    .selectFrom("integracao.sync_runs")
    .select("finalizado_em")
    .where("sistema", "=", "mkt_rd_station")
    .where("status", "=", "sucesso")
    .orderBy("finalizado_em", "desc")
    .limit(1)
    .executeTakeFirst();
}

export function rdContatos(tx: Tx) {
  return tx
    .selectFrom("marketing.rd_contatos")
    .select([
      "uuid",
      "nome",
      "email",
      "telefone",
      "cidade",
      "uf",
      "tags",
      "etapa",
      "criado_em",
    ])
    .orderBy("uuid")
    .execute();
}

export function rdConversoes(tx: Tx) {
  return tx
    .selectFrom("marketing.rd_conversoes")
    .select([
      "id",
      "contato_uuid",
      "identificador",
      "convertido_em",
      "origem",
      "meio",
      "campanha",
    ])
    .orderBy("id")
    .execute();
}

export function rdLandingPagesDia(tx: Tx) {
  return tx
    .selectFrom("marketing.rd_landing_pages_dia")
    .select(["identificador", "dia", "nome", "visitas", "conversoes"])
    .orderBy("dia")
    .orderBy("identificador")
    .execute();
}

export function contagensDasCameras(tx: Tx, desde: string) {
  return tx
    .selectFrom("integracao.camera_contagens")
    .select(["deviceid", "inicio", "entradas"])
    .where("inicio", ">=", desde)
    .orderBy("inicio")
    .orderBy("deviceid")
    .execute();
}

/** Entradas de veículos por dia no estacionamento (WPS), somando os tipos. */
export function entradasDoEstacionamento(tx: Tx, desde: string) {
  return tx
    .selectFrom("financeiro.estacionamento_movimento")
    .select([
      sql<string>`data::text`.as("dia"),
      sql<number>`sum(entradas)::int`.as("entradas"),
    ])
    .where("data", ">=", desde)
    .groupBy("data")
    .orderBy("data")
    .execute();
}

export function cameras(tx: Tx) {
  return tx
    .selectFrom("integracao.cameras")
    .select(["deviceid", "ultimo_contato"])
    .orderBy("deviceid")
    .execute();
}
