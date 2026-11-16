import type { TipoImportacao } from "@arp/shared/operacoes/importacoes";
import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Consultas comuns às importações de Operações (operacoes.importacoes) e as
// funções do banco que confirmam e desfazem (elas conferem a permissão do
// tipo com auth.uid(): só no escopo da pessoa).

/** Importação do tipo, num dos status, que já recebeu o mesmo arquivo. */
export function importacaoDoArquivo(
  tx: Tx,
  tipo: TipoImportacao,
  hash: string,
  status: string[] = ["previa", "confirmada"],
) {
  return tx
    .selectFrom("operacoes.importacoes")
    .select([
      "id",
      "status",
      "referencia",
      "criado_por",
      "criado_em",
      "confirmado_em",
    ])
    .where("tipo", "=", tipo)
    .where("status", "in", status)
    .where(
      sql<boolean>`arquivos @> ${JSON.stringify([{ sha256: hash }])}::jsonb`,
    )
    .orderBy("criado_em", "desc")
    .execute();
}

export function importacao(tx: Tx, id: string) {
  return tx
    .selectFrom("operacoes.importacoes")
    .select([
      "id",
      "tipo",
      "status",
      "referencia",
      "bate",
      "resumo",
      "avisos",
      "arquivos",
      "criado_por",
      "substitui",
    ])
    .where("id", "=", id)
    .executeTakeFirst();
}

/** Prévias abertas da pessoa, da mais nova à mais antiga. */
export function previasDaPessoa(
  tx: Tx,
  tipo: TipoImportacao,
  usuarioId: string,
) {
  return tx
    .selectFrom("operacoes.importacoes")
    .select(["id", "referencia", "resumo", "arquivos", "criado_em"])
    .where("tipo", "=", tipo)
    .where("status", "=", "previa")
    .where("criado_por", "=", usuarioId)
    .orderBy("criado_em", "desc")
    .execute();
}

export function inserirImportacao(
  tx: Tx,
  v: {
    tipo: TipoImportacao;
    referencia: string;
    arquivos: unknown;
    resumo: unknown;
    avisos: unknown;
    bate: boolean | null;
    criado_por: string;
  },
) {
  return tx
    .insertInto("operacoes.importacoes")
    .values({
      tipo: v.tipo,
      referencia: v.referencia,
      arquivos: JSON.stringify(v.arquivos),
      resumo: JSON.stringify(v.resumo),
      avisos: JSON.stringify(v.avisos),
      bate: v.bate,
      criado_por: v.criado_por,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
}

export function ajustarImportacao(
  tx: Tx,
  id: string,
  v: { referencia: string; resumo: unknown; avisos: unknown },
) {
  return tx
    .updateTable("operacoes.importacoes")
    .set({
      referencia: v.referencia,
      resumo: JSON.stringify(v.resumo),
      avisos: JSON.stringify(v.avisos),
    })
    .where("id", "=", id)
    .execute();
}

/** operacoes.desfazer_importacao: quantos registros saíram. */
export async function desfazer(tx: Tx, id: string): Promise<number> {
  const r = await sql<{
    n: number | null;
  }>`select operacoes.desfazer_importacao(p_id => ${id}) as n`.execute(tx);
  return Number(r.rows[0]?.n ?? 0);
}

/** operacoes.confirmar_importacao (o motivo só quando não bate). */
export async function confirmar(
  tx: Tx,
  id: string,
  motivo?: string | null,
): Promise<void> {
  if (motivo)
    await sql`select operacoes.confirmar_importacao(p_id => ${id}, p_motivo => ${motivo})`.execute(
      tx,
    );
  else
    await sql`select operacoes.confirmar_importacao(p_id => ${id})`.execute(tx);
}

// ---------------------------------------------------------------------------
// Histórico (tela de Importações) e o que cada importação gravou
// ---------------------------------------------------------------------------

const COLUNAS = [
  "id",
  "tipo",
  "status",
  "referencia",
  "arquivos",
  "avisos",
  "bate",
  "incompleta",
  "motivo",
  "exemplo",
  "substitui",
  "criado_por",
  "criado_em",
  "confirmado_por",
  "confirmado_em",
  "desfeito_por",
  "desfeito_em",
] as const;

export interface FiltroDaPagina {
  tipo: string | null;
  status: string | null;
  /** Instantes (ISO) do começo e do fim do dia em Brasília. */
  de: string | null;
  ate: string | null;
  limite: number;
  deslocamento: number;
}

/** Uma página do histórico, da mais nova para a mais antiga, e o total. */
export async function paginaDeImportacoes(tx: Tx, f: FiltroDaPagina) {
  let q = tx.selectFrom("operacoes.importacoes");
  if (f.tipo) q = q.where("tipo", "=", f.tipo);
  if (f.status) q = q.where("status", "=", f.status);
  if (f.de) q = q.where("criado_em", ">=", f.de);
  if (f.ate) q = q.where("criado_em", "<=", f.ate);
  const linhas = await q
    .select(COLUNAS)
    .orderBy("criado_em", "desc")
    .orderBy("id", "desc")
    .limit(f.limite)
    .offset(f.deslocamento)
    .execute();
  const total = await q
    .select((eb) => eb.fn.countAll<number>().as("n"))
    .executeTakeFirst();
  return { linhas, total: Number(total?.n ?? 0) };
}

export function importacaoComResumo(tx: Tx, id: string) {
  return tx
    .selectFrom("operacoes.importacoes")
    .select([...COLUNAS, "resumo"])
    .where("id", "=", id)
    .executeTakeFirst();
}

export function valoresDaImportacao(tx: Tx, id: string) {
  return tx
    .selectFrom("operacoes.importacao_valores")
    .select(["valor_arquivo", "valor_lido", "por_bloco"])
    .where("importacao_id", "=", id)
    .executeTakeFirst();
}

/** A que de fato tomou o lugar desta (a desfeita devolveu o mês a esta). */
export async function substituidaPor(tx: Tx, id: string) {
  const r = await tx
    .selectFrom("operacoes.importacoes")
    .select("id")
    .where("substitui", "=", id)
    .where("status", "in", ["confirmada", "substituida"])
    .orderBy("criado_em", "desc")
    .limit(1)
    .executeTakeFirst();
  return r?.id ?? null;
}

export function leiturasDaImportacao(tx: Tx, id: string) {
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
      "l.linha_arquivo",
      "l.vigente",
      "v.valor",
    ])
    .where("l.importacao_id", "=", id)
    .orderBy("l.bloco")
    .orderBy("l.sala")
    .orderBy("l.hidrometro")
    .orderBy("l.id")
    .execute();
}

export function contaDaImportacao(tx: Tx, id: string) {
  return tx
    .selectFrom("operacoes.agua_contas")
    .select([
      "id",
      "vigente",
      "referencia",
      "matricula",
      "vencimento",
      "data_anterior",
      "data_atual",
      "leitura_anterior",
      "leitura_atual",
      "consumo_m3",
      "valor_agua",
      "valor_esgoto",
      "total",
      "observacao",
      "atualizado_em",
    ])
    .where("importacao_id", "=", id)
    .executeTakeFirst();
}

export function faturasDaImportacao(tx: Tx, id: string) {
  return tx
    .selectFrom("operacoes.energia_faturas")
    .select([
      "id",
      "matricula",
      "referencia",
      "vencimento",
      "consumo_kwh",
      "total",
      "vigente",
    ])
    .where("importacao_id", "=", id)
    .orderBy("matricula")
    .execute();
}

export function mesesDaImportacao(tx: Tx, id: string) {
  return tx
    .selectFrom("operacoes.limpeza_meses")
    .select(["referencia", "status", "valor_base"])
    .where("importacao_id", "=", id)
    .orderBy("referencia", "desc")
    .execute();
}

export function revisaoDaImportacao(tx: Tx, id: string) {
  return tx
    .selectFrom("operacoes.orcamento_revisoes as r")
    .leftJoin("operacoes.obras as o", "o.id", "r.obra_id")
    .select((eb) => [
      "r.obra_id",
      "r.codigo",
      "r.vigente",
      "o.nome as obra",
      eb
        .selectFrom("operacoes.orcamento_etapas as e")
        .select((e) => e.fn.countAll<number>().as("n"))
        .whereRef("e.revisao_id", "=", "r.id")
        .as("etapas"),
    ])
    .where("r.importacao_id", "=", id)
    .executeTakeFirst();
}

/** A última importação confirmada do tipo e quantas prévias estão abertas. */
export async function situacaoDoTipo(tx: Tx, tipo: TipoImportacao) {
  const ultima = await tx
    .selectFrom("operacoes.importacoes")
    .select(["id", "referencia", "confirmado_em", "incompleta"])
    .where("tipo", "=", tipo)
    .where("status", "=", "confirmada")
    .orderBy(sql`confirmado_em desc nulls last`)
    .limit(1)
    .executeTakeFirst();
  const previas = await tx
    .selectFrom("operacoes.importacoes")
    .select((eb) => eb.fn.countAll<number>().as("n"))
    .where("tipo", "=", tipo)
    .where("status", "=", "previa")
    .executeTakeFirst();
  return { ultima, previas: Number(previas?.n ?? 0) };
}
