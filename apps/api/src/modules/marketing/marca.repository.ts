import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Consultas da Marca: blocos, versões e arquivos (RLS por marketing.marca).

export function blocos(tx: Tx) {
  return tx
    .selectFrom("marketing.marca_blocos")
    .select([
      "chave",
      "aba",
      "titulo",
      "descricao",
      "tipo",
      "ordem",
      "conteudo",
      "versao",
      "atualizado_em",
    ])
    .orderBy("aba")
    .orderBy("ordem")
    .execute();
}

export function versoes(tx: Tx, limite: number) {
  return tx
    .selectFrom("marketing.marca_versoes")
    .select(["id", "bloco", "versao", "antes", "depois", "desfaz", "por", "em"])
    .orderBy("em", "desc")
    .orderBy("id", "desc")
    .limit(limite)
    .execute();
}

export function ultimaVersao(tx: Tx) {
  return tx
    .selectFrom("marketing.marca_versoes")
    .select(["em", "por", "versao"])
    .orderBy("em", "desc")
    .orderBy("id", "desc")
    .limit(1)
    .executeTakeFirst();
}

export function arquivos(tx: Tx) {
  return tx
    .selectFrom("marketing.marca_arquivos")
    .selectAll()
    .orderBy("enviado_em")
    .orderBy("versao", "desc")
    .execute();
}

export function arquivo(tx: Tx, id: string) {
  return tx
    .selectFrom("marketing.marca_arquivos")
    .select(["arquivo_path", "arquivo_nome"])
    .where("id", "=", id)
    .executeTakeFirst();
}

export function nomes(tx: Tx, ids: string[]) {
  return tx
    .selectFrom("core.usuarios")
    .select(["id", "nome"])
    .where("id", "in", ids)
    .execute();
}

export function bloco(tx: Tx, chave: string) {
  return tx
    .selectFrom("marketing.marca_blocos")
    .select(["tipo", "conteudo", "versao"])
    .where("chave", "=", chave)
    .executeTakeFirst();
}

/** Grava só se a versão ainda é a lida (não sobrescreve outra pessoa). */
export async function gravarBloco(
  tx: Tx,
  chave: string,
  versao: number,
  conteudo: unknown,
): Promise<boolean> {
  const r = await tx
    .updateTable("marketing.marca_blocos")
    .set({ conteudo: JSON.stringify(conteudo) })
    .where("chave", "=", chave)
    .where("versao", "=", versao)
    .executeTakeFirst();
  return r.numUpdatedRows > 0n;
}

export async function desfazerVersao(tx: Tx, id: number): Promise<void> {
  await sql`select marketing.desfazer_versao(p_versao => ${id})`.execute(tx);
}

export async function novoArquivo(
  tx: Tx,
  a: {
    grupo: string;
    titulo: string;
    descricao: string | null;
    referencia: boolean;
  },
) {
  await tx.insertInto("marketing.marca_arquivos").values(a).execute();
}

export function doGrupo(tx: Tx, grupo: string) {
  return tx
    .selectFrom("marketing.marca_arquivos")
    .select([
      "id",
      "versao",
      "atual",
      "arquivo_path",
      "titulo",
      "descricao",
      "referencia",
    ])
    .where("grupo", "=", grupo)
    .orderBy("versao", "desc")
    .execute();
}

export interface DadosDoArquivo {
  arquivo_nome: string;
  arquivo_path: string;
  tamanho: number;
  tipo_mime: string;
  enviado_por: string;
  enviado_em: string;
}

/** Primeiro envio: preenche a linha que esperava o arquivo. */
export async function preencherArquivo(tx: Tx, id: string, d: DadosDoArquivo) {
  await tx
    .updateTable("marketing.marca_arquivos")
    .set(d)
    .where("id", "=", id)
    .where("arquivo_path", "is", null)
    .execute();
}

/** Versão nova: a anterior deixa de ser a atual. */
export async function substituirArquivo(
  tx: Tx,
  anterior: string,
  nova: DadosDoArquivo & {
    grupo: string;
    titulo: string;
    descricao: string | null;
    referencia: boolean;
    versao: number;
  },
) {
  await tx
    .updateTable("marketing.marca_arquivos")
    .set({ atual: false })
    .where("id", "=", anterior)
    .execute();
  await tx
    .insertInto("marketing.marca_arquivos")
    .values({ ...nova, atual: true })
    .execute();
}
