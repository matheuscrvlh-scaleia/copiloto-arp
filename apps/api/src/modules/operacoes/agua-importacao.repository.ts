import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Consultas da importação mensal da água (prévia e confirmação).

/** A importação confirmada de um mês (a que a prévia vai substituir). */
export function confirmadaDoMes(tx: Tx, referencia: string, outraQue?: string) {
  let q = tx
    .selectFrom("operacoes.importacoes")
    .select(["id", "incompleta", "confirmado_em", "confirmado_por"])
    .where("tipo", "=", "agua")
    .where("status", "=", "confirmada")
    .where("referencia", "=", referencia);
  if (outraQue) q = q.where("id", "<>", outraQue);
  return q.executeTakeFirst();
}

/** Leituras de uma importação, com o valor em reais (service role). */
export function leiturasComValor(tx: Tx, importacaoId: string) {
  return tx
    .selectFrom("operacoes.agua_leituras as l")
    .leftJoin("operacoes.agua_valores as v", "v.leitura_id", "l.id")
    .select([
      "l.id",
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
      "v.valor",
    ])
    .where("l.importacao_id", "=", importacaoId)
    .orderBy("l.id")
    .execute();
}

/** Leitura atual do mês passado dos hidrômetros. */
export function atuaisDoMes(tx: Tx, referencia: string, hidrometros: string[]) {
  if (!hidrometros.length) return Promise.resolve([]);
  return tx
    .selectFrom("operacoes.agua_leituras")
    .select(["hidrometro", "leitura_atual"])
    .where("vigente", "=", true)
    .where("referencia", "=", referencia)
    .where("hidrometro", "in", hidrometros)
    .execute();
}

/** Hidrômetros que já tinham leitura antes do mês. */
export function vistosAntes(tx: Tx, referencia: string, hidrometros: string[]) {
  if (!hidrometros.length) return Promise.resolve([]);
  return tx
    .selectFrom("operacoes.agua_leituras")
    .select("hidrometro")
    .where("vigente", "=", true)
    .where("referencia", "<", referencia)
    .where("hidrometro", "in", hidrometros)
    .execute();
}

/** Há alguma leitura que vale antes do mês? */
export async function temHistorico(tx: Tx, referencia: string) {
  const r = await tx
    .selectFrom("operacoes.agua_leituras")
    .select("id")
    .where("vigente", "=", true)
    .where("referencia", "<", referencia)
    .limit(1)
    .executeTakeFirst();
  return r !== undefined;
}

export function cadastrados(tx: Tx, numeros: string[]) {
  if (!numeros.length) return Promise.resolve([]);
  return tx
    .selectFrom("operacoes.hidrometros")
    .select("numero")
    .where("numero", "in", numeros)
    .execute();
}

export function inserirValoresDaImportacao(
  tx: Tx,
  v: {
    importacao_id: string;
    valor_arquivo: number | null;
    valor_lido: number;
    por_bloco: unknown;
  },
) {
  return tx
    .insertInto("operacoes.importacao_valores")
    .values({ ...v, por_bloco: JSON.stringify(v.por_bloco) })
    .execute();
}

export interface LeituraParaGravar {
  id: string;
  importacao_id: string;
  referencia: string;
  bloco: string;
  sala: string;
  cliente: string;
  hidrometro: string;
  data_anterior: string | null;
  leitura_anterior: number | null;
  data_atual: string | null;
  leitura_atual: number | null;
  dias: number | null;
  consumo: number;
  volume_faturado: number;
  tipo: string;
  foto: string | null;
  linha_arquivo: number | null;
}

export function inserirLeituras(tx: Tx, linhas: LeituraParaGravar[]) {
  return tx.insertInto("operacoes.agua_leituras").values(linhas).execute();
}

export function inserirValores(
  tx: Tx,
  valores: { leitura_id: string; valor: number }[],
) {
  return tx.insertInto("operacoes.agua_valores").values(valores).execute();
}

export function salvarModelo(tx: Tx, modelo: unknown, usuarioId: string) {
  return tx
    .updateTable("operacoes.parametros")
    .set({ agua_modelo: JSON.stringify(modelo), atualizado_por: usuarioId })
    .where("id", "=", true)
    .execute();
}

export function valoresDaImportacao(tx: Tx, id: string) {
  return tx
    .selectFrom("operacoes.importacao_valores")
    .select(["valor_lido", "por_bloco"])
    .where("importacao_id", "=", id)
    .executeTakeFirst();
}

/** Linhas da prévia, na ordem do bloco e da sala. */
export function linhasDaPrevia(tx: Tx, id: string) {
  return tx
    .selectFrom("operacoes.agua_leituras as l")
    .leftJoin("operacoes.agua_valores as v", "v.leitura_id", "l.id")
    .select([
      "l.id",
      "l.bloco",
      "l.sala",
      "l.cliente",
      "l.hidrometro",
      "l.leitura_anterior",
      "l.leitura_atual",
      "l.consumo",
      "l.volume_faturado",
      "l.tipo",
      "l.foto",
      "l.linha_arquivo",
      "v.valor",
    ])
    .where("l.importacao_id", "=", id)
    .orderBy("l.bloco")
    .orderBy("l.sala")
    .orderBy("l.id")
    .execute();
}

/** Alguma importação da água já usa a pasta do envio? */
export async function envioUsado(tx: Tx, pasta: string) {
  const r = await tx
    .selectFrom("operacoes.importacoes")
    .select("id")
    .where("tipo", "=", "agua")
    .where(sql<string>`resumo->>'pasta'`, "=", pasta)
    .limit(1)
    .executeTakeFirst();
  return r !== undefined;
}
