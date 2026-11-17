import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Consultas dos formulários específicos (spec 4.13): o formulário com o
// rascunho, as versões publicadas (imutáveis), o log do rascunho e o uso.

export async function idDoQuestionario(tx: Tx): Promise<string | null> {
  const r = await tx
    .selectFrom("sustentabilidade.formularios")
    .select("id")
    .where("tipo", "=", "questionario")
    .executeTakeFirst();
  return r?.id ?? null;
}

export function ultimaVersao(tx: Tx, formularioId: string) {
  return tx
    .selectFrom("sustentabilidade.formulario_versoes")
    .select(["versao", "definicao"])
    .where("formulario_id", "=", formularioId)
    .orderBy("versao", "desc")
    .limit(1)
    .executeTakeFirst();
}

export function versao(tx: Tx, formularioId: string, versao: number) {
  return tx
    .selectFrom("sustentabilidade.formulario_versoes")
    .select("definicao")
    .where("formulario_id", "=", formularioId)
    .where("versao", "=", versao)
    .executeTakeFirst();
}

export function versoes(tx: Tx, formularioId: string) {
  return tx
    .selectFrom("sustentabilidade.formulario_versoes")
    .select(["versao", "resumo", "publicado_por", "publicado_em"])
    .where("formulario_id", "=", formularioId)
    .orderBy("versao", "desc")
    .execute();
}

/** Formulários do programa, com a contagem de lançamentos de cada um. */
export function doPrograma(tx: Tx, programaId: string) {
  return tx
    .selectFrom("sustentabilidade.formularios as f")
    .select((eb) => [
      "f.id",
      "f.nome",
      "f.ativo",
      "f.versao_publicada",
      "f.rascunho",
      eb
        .selectFrom("sustentabilidade.lancamentos as l")
        .select((e) => e.fn.countAll<number>().as("n"))
        .whereRef("l.formulario_id", "=", "f.id")
        .as("lancamentos"),
    ])
    .where("f.tipo", "=", "programa")
    .where("f.programa_id", "=", programaId)
    .orderBy("f.nome")
    .execute();
}

export function formulario(tx: Tx, id: string) {
  return tx
    .selectFrom("sustentabilidade.formularios")
    .select([
      "id",
      "tipo",
      "programa_id",
      "nome",
      "ativo",
      "versao_publicada",
      "rascunho",
      "rascunho_alterado",
      // Com os microssegundos do banco: é a versão otimista (o ISO do
      // driver, em milissegundos, nunca bateria na comparação).
      sql<string>`to_char(atualizado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`.as(
        "atualizado_em",
      ),
      "exemplo",
    ])
    .where("id", "=", id)
    .executeTakeFirst();
}

export async function usoDoFormulario(tx: Tx, id: string) {
  const r = await sql<{
    pergunta_id: string;
    opcao_id: string | null;
    usos: number;
  }>`select pergunta_id, opcao_id, usos from sustentabilidade.uso_do_formulario(p_id => ${id})`.execute(
    tx,
  );
  return r.rows;
}

export function indicadores(tx: Tx, formularioId: string) {
  return tx
    .selectFrom("sustentabilidade.programa_indicadores")
    .select(["nome", "campo_id", "filtro", "ativo"])
    .where("formulario_id", "=", formularioId)
    .execute();
}

/** Quando o rascunho foi descartado pela última vez (marco no log). */
export async function ultimoDescarte(
  tx: Tx,
  formularioId: string,
  marco: object,
): Promise<string | null> {
  const r = await tx
    .selectFrom("sustentabilidade.formulario_alteracoes")
    .select("quando")
    .where("formulario_id", "=", formularioId)
    .where(sql<boolean>`depois @> ${JSON.stringify(marco)}::jsonb`)
    .orderBy("quando", "desc")
    .limit(1)
    .executeTakeFirst();
  return r?.quando ?? null;
}

export async function alteracoes(
  tx: Tx,
  formularioId: string,
  desde: string | undefined,
  limite: number,
) {
  let base = tx
    .selectFrom("sustentabilidade.formulario_alteracoes")
    .where("formulario_id", "=", formularioId);
  if (desde) base = base.where("quando", ">", desde);
  const total = await base
    .select((eb) => eb.fn.countAll<number>().as("n"))
    .executeTakeFirst();
  const linhas = await base
    .select(["id", "quando", "quem", "descricao"])
    .orderBy("quando", "desc")
    .limit(limite)
    .execute();
  return { linhas, total: Number(total?.n ?? 0) };
}

export async function nomeDoPrograma(
  tx: Tx,
  id: string,
): Promise<string | null> {
  const r = await tx
    .selectFrom("sustentabilidade.programas")
    .select("nome")
    .where("id", "=", id)
    .executeTakeFirst();
  return r?.nome ?? null;
}

/** Entrevistas salvas de uma versão do questionário (só a contagem). */
export async function entrevistasDaVersao(
  tx: Tx,
  versao: number,
): Promise<number> {
  const r = await tx
    .selectFrom("sustentabilidade.entrevistas")
    .select((eb) => eb.fn.countAll<number>().as("n"))
    .where("situacao", "=", "salva")
    .where("formulario_versao", "=", versao)
    .executeTakeFirst();
  return Number(r?.n ?? 0);
}

/** Lançamentos do formulário (de uma versão, ou de todas). */
export async function lancamentosDoFormulario(
  tx: Tx,
  formularioId: string,
  versao?: number,
): Promise<number> {
  let q = tx
    .selectFrom("sustentabilidade.lancamentos")
    .select((eb) => eb.fn.countAll<number>().as("n"))
    .where("formulario_id", "=", formularioId);
  if (versao !== undefined) q = q.where("formulario_versao", "=", versao);
  const r = await q.executeTakeFirst();
  return Number(r?.n ?? 0);
}

// ---------------------------------------------------------------- gravações

export async function registrarAlteracao(
  tx: Tx,
  formularioId: string,
  a: { descricao: string; antes: unknown; depois: unknown },
) {
  await tx
    .insertInto("sustentabilidade.formulario_alteracoes")
    .values({
      formulario_id: formularioId,
      descricao: a.descricao.slice(0, 500),
      antes: JSON.stringify(a.antes ?? null),
      depois: JSON.stringify(a.depois ?? null),
    })
    .execute();
}

/** Grava o rascunho só se ninguém gravou depois de `atualizadoEm`. */
export async function gravarRascunho(
  tx: Tx,
  id: string,
  atualizadoEm: string,
  rascunho: unknown,
  alterado: boolean,
): Promise<boolean> {
  const r = await tx
    .updateTable("sustentabilidade.formularios")
    .set({ rascunho: JSON.stringify(rascunho), rascunho_alterado: alterado })
    .where("id", "=", id)
    .where(sql<boolean>`atualizado_em = ${atualizadoEm}::timestamptz`)
    .executeTakeFirst();
  return r.numUpdatedRows > 0n;
}

export async function publicar(
  tx: Tx,
  id: string,
  resumo: string,
): Promise<number> {
  const r = await sql<{
    versao: number;
  }>`select sustentabilidade.publicar_formulario(p_id => ${id}, p_resumo => ${resumo}) as versao`.execute(
    tx,
  );
  return Number(r.rows[0]?.versao ?? 0);
}

export async function criar(
  tx: Tx,
  f: {
    programa_id: string | null;
    nome: string;
    rascunho: unknown;
    rascunho_alterado?: boolean;
  },
): Promise<string> {
  const r = await tx
    .insertInto("sustentabilidade.formularios")
    .values({
      tipo: "programa",
      programa_id: f.programa_id,
      nome: f.nome,
      rascunho: JSON.stringify(f.rascunho),
      ...(f.rascunho_alterado !== undefined && {
        rascunho_alterado: f.rascunho_alterado,
      }),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return r.id;
}

export async function alterar(
  tx: Tx,
  id: string,
  campos: { nome?: string; ativo?: boolean },
): Promise<boolean> {
  const r = await tx
    .updateTable("sustentabilidade.formularios")
    .set(campos)
    .where("id", "=", id)
    .executeTakeFirst();
  return r.numUpdatedRows > 0n;
}

export async function excluir(tx: Tx, id: string): Promise<boolean> {
  const r = await tx
    .deleteFrom("sustentabilidade.formularios")
    .where("id", "=", id)
    .executeTakeFirst();
  return r.numDeletedRows > 0n;
}
