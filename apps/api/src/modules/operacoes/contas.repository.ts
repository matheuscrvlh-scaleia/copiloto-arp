import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Consultas das contas da área comum (faturas da Energisa) e da consulta da
// energia solar, com a sessão (RLS: operacoes.energia.contas ou
// operacoes.solar.ver). Só faturas vigentes (importação confirmada); as da
// prévia ficam na tela de importação.

export const COLUNAS_FATURA = [
  "id",
  "matricula",
  "referencia",
  "vencimento",
  "medidor",
  "consumo_kwh",
  "valor_consumo",
  "compensado_kwh",
  "valor_compensado",
  "injetada_kwh",
  "bandeira",
  "valor_bandeira",
  "iluminacao_publica",
  "icms",
  "pis_cofins",
  "total",
  "saldo_kwh",
  "expirar_kwh",
  "classificacao_gd",
  "arquivo",
  "exemplo",
] as const;

export function unidades(tx: Tx) {
  return tx
    .selectFrom("operacoes.energia_unidades")
    .select([
      "matricula",
      "apelido",
      "endereco",
      "classificacao",
      "ligacao",
      "papel",
      "ativa",
      "exemplo",
    ])
    .orderBy("matricula")
    .execute();
}

/** Meses com fatura vigente, do mais recente para o mais antigo. */
export async function mesesComFatura(tx: Tx): Promise<string[]> {
  const linhas = await tx
    .selectFrom("operacoes.energia_faturas")
    .select("referencia")
    .distinct()
    .where("vigente", "=", true)
    .orderBy("referencia", "desc")
    .execute();
  return linhas.map((l) => l.referencia);
}

/** Faturas vigentes entre dois meses (inclusive). */
export function faturasEntre(tx: Tx, inicio: string, fim: string) {
  return tx
    .selectFrom("operacoes.energia_faturas")
    .select([...COLUNAS_FATURA])
    .where("vigente", "=", true)
    .where("referencia", ">=", inicio)
    .where("referencia", "<=", fim)
    .orderBy("referencia")
    .orderBy("matricula")
    .orderBy("id")
    .execute();
}

export function fatura(tx: Tx, id: string) {
  return tx
    .selectFrom("operacoes.energia_faturas")
    .select([
      ...COLUNAS_FATURA,
      "leitura_anterior_data",
      "leitura_atual_data",
      "proxima_leitura",
      "dias",
      "leitura_anterior",
      "leitura_atual",
      "nota_fiscal",
      "observacao",
      "importado_em",
      "vigente",
    ])
    .where("id", "=", id)
    .executeTakeFirst();
}

export function itensDaFatura(tx: Tx, id: string) {
  return tx
    .selectFrom("operacoes.energia_fatura_itens")
    .select([
      "id",
      "ordem",
      "descricao",
      "tipo",
      "origem",
      "mes_geracao",
      "unidade",
      "quantidade",
      "preco_unitario",
      "valor",
      "pis_cofins",
      "base_icms",
      "aliquota_icms",
      "icms",
      "tarifa_unitaria",
    ])
    .where("fatura_id", "=", id)
    .orderBy("ordem")
    .execute();
}

/** Créditos usados (itens "Injetada") das faturas vigentes do mês. */
export function creditosDoMes(tx: Tx, mes: string) {
  return tx
    .selectFrom("operacoes.energia_fatura_itens as i")
    .innerJoin("operacoes.energia_faturas as f", "f.id", "i.fatura_id")
    .select([
      "f.matricula",
      "i.origem",
      "i.mes_geracao",
      "i.quantidade",
      "i.valor",
    ])
    .where("i.tipo", "=", "injetada")
    .where("f.referencia", "=", mes)
    .where("f.vigente", "=", true)
    .orderBy("i.id")
    .execute();
}

// ---------------------------------------------------------------------------
// Importação das faturas da Energisa
// ---------------------------------------------------------------------------

export function unidadesDasMatriculas(tx: Tx, matriculas: string[]) {
  return tx
    .selectFrom("operacoes.energia_unidades")
    .select(["matricula", "apelido", "papel"])
    .where("matricula", "in", matriculas)
    .execute();
}

export function faturasDasImportacoes(tx: Tx, ids: string[]) {
  return tx
    .selectFrom("operacoes.energia_faturas")
    .select("importacao_id")
    .where("importacao_id", "in", ids)
    .execute();
}

/** Consumo vigente das matrículas no período, para a média da prévia. */
export function historicoDeConsumo(
  tx: Tx,
  matriculas: string[],
  desde: string,
  antesDe: string,
) {
  return tx
    .selectFrom("operacoes.energia_faturas")
    .select(["id", "matricula", "referencia", "consumo_kwh"])
    .where("vigente", "=", true)
    .where("matricula", "in", matriculas)
    .where("referencia", ">=", desde)
    .where("referencia", "<", antesDe)
    .orderBy("id")
    .execute();
}

export function faturaVigente(tx: Tx, matricula: string, referencia: string) {
  return tx
    .selectFrom("operacoes.energia_faturas")
    .select("id")
    .where("matricula", "=", matricula)
    .where("referencia", "=", referencia)
    .where("vigente", "=", true)
    .executeTakeFirst();
}

/** Prévias da Energisa do mês para a matrícula (de qualquer pessoa). */
export function previasDaMatricula(
  tx: Tx,
  matricula: string,
  referencia: string,
) {
  return tx
    .selectFrom("operacoes.importacoes")
    .select(["id", "criado_por"])
    .where("tipo", "=", "energisa")
    .where("status", "=", "previa")
    .where("referencia", "=", referencia)
    .where(sql<boolean>`resumo->>'matricula' = ${matricula}`)
    .execute();
}

/** As prévias da Energisa abertas pela pessoa, da mais antiga à mais nova. */
export function minhasPrevias(tx: Tx, usuarioId: string) {
  return tx
    .selectFrom("operacoes.importacoes")
    .select(["id", "resumo"])
    .where("tipo", "=", "energisa")
    .where("status", "=", "previa")
    .where("criado_por", "=", usuarioId)
    .orderBy("criado_em")
    .limit(100)
    .execute();
}

export function arquivosDasImportacoes(tx: Tx, ids: string[]) {
  return tx
    .selectFrom("operacoes.importacoes")
    .select(["id", "arquivos"])
    .where("id", "in", ids)
    .execute();
}

export function unidadeExiste(tx: Tx, matricula: string) {
  return tx
    .selectFrom("operacoes.energia_unidades")
    .select("matricula")
    .where("matricula", "=", matricula)
    .executeTakeFirst();
}

export function inserirUnidade(
  tx: Tx,
  u: {
    matricula: string;
    apelido: string | null;
    papel: string;
    endereco: string | null;
    classificacao: string | null;
    ligacao: string | null;
  },
) {
  return tx.insertInto("operacoes.energia_unidades").values(u).execute();
}

/** operacoes.gravar_fatura_energisa: a fatura e os itens da prévia. */
export async function gravarFatura(
  tx: Tx,
  v: {
    importacao: string;
    arquivo: string;
    sha256: string;
    fatura: unknown;
    itens: unknown;
  },
): Promise<void> {
  await sql`select operacoes.gravar_fatura_energisa(
    p_importacao => ${v.importacao},
    p_arquivo => ${v.arquivo},
    p_sha256 => ${v.sha256},
    p_fatura => ${JSON.stringify(v.fatura)}::jsonb,
    p_itens => ${JSON.stringify(v.itens)}::jsonb
  )`.execute(tx);
}
