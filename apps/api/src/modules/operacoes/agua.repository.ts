import type { Tx } from "@/infra/banco";

// Consultas da água: meses importados, leituras vigentes (com o valor, que o
// RLS esconde sem operacoes.agua.valores), correções de vínculo e os
// contratos vigentes do ENET.

export function mesesImportados(tx: Tx) {
  return tx
    .selectFrom("operacoes.importacoes")
    .select([
      "id",
      "referencia",
      "incompleta",
      "motivo",
      "confirmado_em",
      "confirmado_por",
      "exemplo",
    ])
    .where("tipo", "=", "agua")
    .where("status", "=", "confirmada")
    .orderBy("referencia", "desc")
    .execute();
}

export function vinculos(tx: Tx) {
  return tx
    .selectFrom("operacoes.agua_vinculos")
    .select([
      "id",
      "hidrometro",
      "desde",
      "bloco",
      "sala",
      "motivo",
      "criado_por",
      "criado_em",
    ])
    .orderBy("hidrometro")
    .orderBy("desde")
    .execute();
}

export type FiltroDeLeituras =
  | { referencia: string }
  | { hidrometro: string }
  | { de: string; ate: string };

/** Leituras vigentes, na ordem do mês, do bloco e do id. */
export function leituras(tx: Tx, f: FiltroDeLeituras) {
  let q = tx
    .selectFrom("operacoes.agua_leituras as l")
    .leftJoin("operacoes.agua_valores as v", "v.leitura_id", "l.id")
    .select([
      "l.id",
      "l.importacao_id",
      "l.referencia",
      "l.bloco",
      "l.sala",
      "l.cliente",
      "l.hidrometro",
      "l.data_anterior",
      "l.leitura_anterior",
      "l.data_atual",
      "l.leitura_atual",
      "l.dias",
      "l.consumo",
      "l.volume_faturado",
      "l.tipo",
      "l.foto",
      "l.exemplo",
      "v.valor",
    ])
    .where("l.vigente", "=", true);
  if ("referencia" in f) q = q.where("l.referencia", "=", f.referencia);
  else if ("hidrometro" in f) q = q.where("l.hidrometro", "=", f.hidrometro);
  else
    q = q.where("l.referencia", ">=", f.de).where("l.referencia", "<=", f.ate);
  return q.orderBy("l.referencia").orderBy("l.bloco").orderBy("l.id").execute();
}
export type LinhaDeLeitura = Awaited<ReturnType<typeof leituras>>[number];

/** Contratos vigentes do ENET (os.lojas). Service role: quem chama confere. */
export function contratosEnet(tx: Tx) {
  return tx
    .selectFrom("os.lojas")
    .select(["bloco", "luc", "locatario", "nome"])
    .where("situacao", "=", "vigente")
    .orderBy("luc")
    .orderBy("id")
    .execute();
}

export function inserirVinculo(
  tx: Tx,
  v: {
    hidrometro: string;
    desde: string;
    bloco: string;
    sala: string;
    motivo: string;
    criado_por: string;
  },
) {
  return tx.insertInto("operacoes.agua_vinculos").values(v).execute();
}

export function removerVinculo(tx: Tx, id: string) {
  return tx
    .deleteFrom("operacoes.agua_vinculos")
    .where("id", "=", id)
    .returning("id")
    .execute();
}
