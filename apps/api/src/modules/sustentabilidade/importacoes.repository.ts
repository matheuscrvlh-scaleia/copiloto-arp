import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Consultas das importações do histórico (spec 4.10).

export function importacoes(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.importacoes")
    .selectAll()
    .orderBy("criado_em", "desc")
    .orderBy("id")
    .limit(500)
    .execute();
}

export function importacao(tx: Tx, id: string) {
  return tx
    .selectFrom("sustentabilidade.importacoes")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
}

export function importacaoBruta(tx: Tx, id: string) {
  return tx
    .selectFrom("sustentabilidade.importacoes")
    .select([
      "id",
      "tipo",
      "status",
      "arquivo",
      "decisoes",
      "substitui",
      "criado_por",
    ])
    .where("id", "=", id)
    .executeTakeFirst();
}

// ------------------------------------------------------------------- prévia

export function contratosParaCasar(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.contratos")
    .select([
      "id",
      "lucs",
      "cliente_nome",
      "cliente_doc",
      "validade_meses_especifica",
    ])
    .orderBy("cliente_nome")
    .orderBy("id")
    .execute();
}

/** Entrevistas salvas (contrato e data). Service role: quem chama conferiu. */
export function entrevistasSalvas(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.entrevistas")
    .select(["id", "contrato_id", "data", "importacao_id"])
    .where("situacao", "=", "salva")
    .orderBy("id")
    .execute();
}

/** Definição da versão 1 do questionário (a do Forms), se existe. */
export async function questionarioV1(tx: Tx): Promise<unknown> {
  const r = await tx
    .selectFrom("sustentabilidade.formulario_versoes as v")
    .innerJoin("sustentabilidade.formularios as f", "f.id", "v.formulario_id")
    .select("v.definicao")
    .where("f.tipo", "=", "questionario")
    .where("v.versao", "=", 1)
    .limit(1)
    .executeTakeFirst();
  return r?.definicao;
}

/** Programas (nome). Service role: quem chama conferiu. */
export function programas(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.programas")
    .select(["id", "nome"])
    .orderBy("nome")
    .execute();
}

export function formulariosPublicados(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.formularios")
    .select(["id", "nome", "programa_id", "versao_publicada"])
    .where("tipo", "=", "programa")
    .where("versao_publicada", ">", 0)
    .orderBy("nome")
    .execute();
}

export async function definicaoDaVersao(
  tx: Tx,
  formularioId: string,
  versao: number,
): Promise<unknown> {
  const r = await tx
    .selectFrom("sustentabilidade.formulario_versoes")
    .select("definicao")
    .where("formulario_id", "=", formularioId)
    .where("versao", "=", versao)
    .executeTakeFirst();
  return r?.definicao;
}

export function cadastroAtual(tx: Tx, programaId: string, campoId: string) {
  return tx
    .selectFrom("sustentabilidade.cadastros_lista")
    .select(["valor", "normalizado"])
    .where("programa_id", "=", programaId)
    .where("campo_id", "=", campoId)
    .orderBy("id")
    .execute();
}

// ------------------------------------------------------------------- passos

export function comOMesmoArquivo(tx: Tx, tipo: string, sha256: string) {
  return tx
    .selectFrom("sustentabilidade.importacoes")
    .select([
      "id",
      "status",
      "criado_por",
      "criado_em",
      "confirmado_em",
      "resumo",
    ])
    .where("tipo", "=", tipo)
    .where("sha256", "=", sha256)
    .where("status", "in", ["previa", "confirmada"])
    .orderBy("criado_em", "desc")
    .execute();
}

export async function criarPrevia(
  tx: Tx,
  l: {
    tipo: string;
    arquivo: { nome: string; caminho: string; bytes: number };
    sha256: string;
    substitui: string | null;
    criado_por: string;
    resumo: unknown;
    avisos: unknown;
  },
): Promise<string> {
  const r = await tx
    .insertInto("sustentabilidade.importacoes")
    .values({
      tipo: l.tipo,
      arquivo: JSON.stringify(l.arquivo),
      sha256: l.sha256,
      substitui: l.substitui,
      criado_por: l.criado_por,
      resumo: JSON.stringify(l.resumo),
      avisos: JSON.stringify(l.avisos),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return r.id;
}

/** Quantas importações guardam este caminho de arquivo. */
export async function comOCaminho(tx: Tx, caminho: string): Promise<number> {
  const r = await tx
    .selectFrom("sustentabilidade.importacoes")
    .select((eb) => eb.fn.countAll<number>().as("n"))
    .where(sql<boolean>`arquivo->>'caminho' = ${caminho}`)
    .executeTakeFirst();
  return Number(r?.n ?? 0);
}

export async function gravarResumo(
  tx: Tx,
  id: string,
  resumo: unknown,
  avisos?: unknown,
) {
  await tx
    .updateTable("sustentabilidade.importacoes")
    .set({
      resumo: JSON.stringify(resumo),
      ...(avisos !== undefined && { avisos: JSON.stringify(avisos) }),
    })
    .where("id", "=", id)
    .execute();
}

export async function gravarEscolhas(
  tx: Tx,
  id: string,
  escolhas: unknown,
): Promise<boolean> {
  const r = await tx
    .updateTable("sustentabilidade.importacoes")
    .set({ decisoes: JSON.stringify(escolhas) })
    .where("id", "=", id)
    .where("status", "=", "previa")
    .executeTakeFirst();
  return r.numUpdatedRows > 0n;
}

export function situacao(tx: Tx, id: string) {
  return tx
    .selectFrom("sustentabilidade.importacoes")
    .select(["tipo", "status", "criado_por", "substitui"])
    .where("id", "=", id)
    .executeTakeFirst();
}

export async function linhasGravadas(
  tx: Tx,
  id: string,
  tabela: "entrevistas" | "lancamentos",
): Promise<number> {
  const r = await tx
    .selectFrom(`sustentabilidade.${tabela}`)
    .select((eb) => eb.fn.countAll<number>().as("n"))
    .where("importacao_id", "=", id)
    .executeTakeFirst();
  return Number(r?.n ?? 0);
}

export async function liberarSubstituida(tx: Tx, id: string) {
  await sql`select sustentabilidade.liberar_substituida(p_id => ${id})`.execute(
    tx,
  );
}

export interface EntrevistaImportada {
  contrato_id: string;
  lucs: string[];
  cliente_doc: string | null;
  data: string;
  tipo: string;
  setor: string | null;
  formulario_versao: number;
  respostas: string;
  situacao: "salva";
  respondente_nome: string | null;
  origem: "forms";
  entrevistador_id: null;
  valida_ate: string | null;
  importacao_id: string;
}

export async function inserirEntrevistas(
  tx: Tx,
  linhas: EntrevistaImportada[],
) {
  if (!linhas.length) return;
  await tx.insertInto("sustentabilidade.entrevistas").values(linhas).execute();
}

export async function inserirCadastros(
  tx: Tx,
  linhas: {
    programa_id: string;
    campo_id: string;
    valor: string;
    normalizado: string;
    importacao_id: string;
  }[],
) {
  if (!linhas.length) return;
  await tx
    .insertInto("sustentabilidade.cadastros_lista")
    .values(linhas)
    .execute();
}

export async function inserirLancamentos(
  tx: Tx,
  linhas: {
    id: string;
    programa_id: string;
    formulario_id: string;
    formulario_versao: number;
    data: string;
    valores: string;
    origem: "importacao";
    importacao_id: string;
  }[],
) {
  if (!linhas.length) return;
  await tx.insertInto("sustentabilidade.lancamentos").values(linhas).execute();
}

export async function inserirReais(
  tx: Tx,
  linhas: { lancamento_id: string; valores: string }[],
) {
  if (!linhas.length) return;
  await tx
    .insertInto("sustentabilidade.lancamento_valores")
    .values(linhas)
    .execute();
}

export async function confirmar(tx: Tx, id: string) {
  await sql`select sustentabilidade.confirmar_importacao(p_id => ${id})`.execute(
    tx,
  );
}

export async function desfazer(tx: Tx, id: string): Promise<number> {
  const r = await sql<{
    n: number;
  }>`select sustentabilidade.desfazer_importacao(p_id => ${id}) as n`.execute(
    tx,
  );
  return Number(r.rows[0]?.n ?? 0);
}
