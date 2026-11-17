import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Consultas dos Programas (spec 4.8): cadastro, contato, indicadores, links
// do parceiro e o movimento do mês. Com a `tx` do `comoUsuario`, o RLS
// decide (programas: "gerenciar", "painel" ou o próprio programa; links:
// só "gerenciar"); com a do `comoServico`, quem chama já conferiu.

const COLUNAS_PROGRAMA = [
  "id",
  "nome",
  "descricao",
  "area",
  "parceiro_nome",
  "parceiro_doc",
  "inicio",
  "fim",
  "frequencia",
  "ativo",
  "exemplo",
] as const;

export function programas(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.programas")
    .select(COLUNAS_PROGRAMA)
    .orderBy("nome")
    .execute();
}

export function programa(tx: Tx, id: string) {
  return tx
    .selectFrom("sustentabilidade.programas")
    .select(COLUNAS_PROGRAMA)
    .where("id", "=", id)
    .executeTakeFirst();
}

const COLUNAS_INDICADOR = [
  "id",
  "programa_id",
  "nome",
  "formulario_id",
  "campo_id",
  "calculo",
  "filtro",
  "percentual_valor",
  "unidade",
  "grupo",
  "mostrar_painel",
  "em_reais",
  "ativo",
  "ordem",
] as const;

/** Indicadores (de um programa ou de todos), na ordem. */
export function indicadores(tx: Tx, programaId?: string) {
  let q = tx
    .selectFrom("sustentabilidade.programa_indicadores")
    .select(COLUNAS_INDICADOR);
  if (programaId) q = q.where("programa_id", "=", programaId);
  return q.orderBy("programa_id").orderBy("ordem").orderBy("nome").execute();
}

/** Contato do parceiro (RLS "Ver contato"; nada sem a permissão). */
export function contato(tx: Tx, programaId: string) {
  return tx
    .selectFrom("sustentabilidade.programa_contatos")
    .select(["email", "telefone", "contato"])
    .where("programa_id", "=", programaId)
    .executeTakeFirst();
}

// ---------------------------------------------------------------- cadastro

export interface CamposDoPrograma {
  nome: string;
  descricao: string | null;
  area: string | null;
  parceiro_nome: string | null;
  parceiro_doc: string | null;
  inicio: string | null;
  fim: string | null;
  frequencia: string;
}

export async function criarPrograma(
  tx: Tx,
  c: CamposDoPrograma,
): Promise<string | undefined> {
  const r = await tx
    .insertInto("sustentabilidade.programas")
    .values(c)
    .returning("id")
    .executeTakeFirst();
  return r?.id;
}

export async function atualizarPrograma(
  tx: Tx,
  id: string,
  c: Partial<CamposDoPrograma> & { ativo?: boolean },
): Promise<boolean> {
  const r = await tx
    .updateTable("sustentabilidade.programas")
    .set(c)
    .where("id", "=", id)
    .executeTakeFirst();
  return r.numUpdatedRows > 0n;
}

export async function gravarContato(
  tx: Tx,
  programaId: string,
  c: { email: string | null; telefone: string | null; contato: string | null },
): Promise<void> {
  await tx
    .insertInto("sustentabilidade.programa_contatos")
    .values({ programa_id: programaId, ...c })
    .onConflict((oc) => oc.column("programa_id").doUpdateSet(c))
    .execute();
}

// ---------------------------------------------------------------- indicadores

export interface CamposDoIndicador {
  nome: string;
  formulario_id: string;
  campo_id: string | null;
  calculo: string;
  /** JSON.stringify de { campo_id, valor } (jsonb), ou null. */
  filtro: string | null;
  percentual_valor: string | null;
  unidade: string | null;
  grupo: string | null;
  mostrar_painel: boolean;
  em_reais: boolean;
  ordem: number;
}

export async function criarIndicador(
  tx: Tx,
  programaId: string,
  c: CamposDoIndicador,
): Promise<boolean> {
  const r = await tx
    .insertInto("sustentabilidade.programa_indicadores")
    .values({ ...c, programa_id: programaId })
    .executeTakeFirst();
  return (r.numInsertedOrUpdatedRows ?? 0n) > 0n;
}

export async function atualizarIndicador(
  tx: Tx,
  programaId: string,
  id: string,
  c: CamposDoIndicador,
): Promise<boolean> {
  const r = await tx
    .updateTable("sustentabilidade.programa_indicadores")
    .set(c)
    .where("id", "=", id)
    .where("programa_id", "=", programaId)
    .executeTakeFirst();
  return r.numUpdatedRows > 0n;
}

export async function situacaoDoIndicador(
  tx: Tx,
  id: string,
  ativo: boolean,
): Promise<boolean> {
  const r = await tx
    .updateTable("sustentabilidade.programa_indicadores")
    .set({ ativo })
    .where("id", "=", id)
    .executeTakeFirst();
  return r.numUpdatedRows > 0n;
}

// ---------------------------------------------------------------- formulários

/** Formulários de programa (o RLS deixa quem usa o módulo ler). */
export function formulariosDoPrograma(tx: Tx, programaId: string) {
  return tx
    .selectFrom("sustentabilidade.formularios")
    .select(["id", "nome", "ativo", "versao_publicada", "rascunho"])
    .where("tipo", "=", "programa")
    .where("programa_id", "=", programaId)
    .orderBy("nome")
    .execute();
}

export function formulario(tx: Tx, id: string) {
  return tx
    .selectFrom("sustentabilidade.formularios")
    .select(["programa_id", "rascunho"])
    .where("id", "=", id)
    .executeTakeFirst();
}

// ---------------------------------------------------------------- movimento

/** Lançamentos do mês por programa e origem. */
export function contagemDoMes(tx: Tx, ids: string[], de: string, ate: string) {
  return tx
    .selectFrom("sustentabilidade.lancamentos")
    .select((eb) => [
      "programa_id",
      "origem",
      eb.fn.countAll<number>().as("total"),
    ])
    .where("programa_id", "in", ids)
    .where("data", ">=", de)
    .where("data", "<=", ate)
    .groupBy(["programa_id", "origem"])
    .execute();
}

/** Data do último lançamento de cada programa (de qualquer mês). */
export function ultimosLancamentos(tx: Tx, ids: string[]) {
  return tx
    .selectFrom("sustentabilidade.lancamentos")
    .select((eb) => ["programa_id", eb.fn.max("data").as("ultimo")])
    .where("programa_id", "in", ids)
    .groupBy("programa_id")
    .execute();
}

// ---------------------------------------------------------------- links

export function links(tx: Tx, programaId: string) {
  return tx
    .selectFrom("sustentabilidade.programa_links as l")
    .select((eb) => [
      "l.id",
      "l.criado_por",
      "l.criado_em",
      "l.desligado_em",
      "l.desligado_por",
      "l.ultimo_acesso_em",
      eb
        .selectFrom("sustentabilidade.lancamentos as x")
        .select((e) => e.fn.countAll<number>().as("n"))
        .whereRef("x.link_id", "=", "l.id")
        .as("lancamentos"),
    ])
    .where("l.programa_id", "=", programaId)
    .orderBy("l.criado_em", "desc")
    .execute();
}

/** Desliga o link ativo do programa; devolve quantos desligou. */
export async function desligarAtivo(
  tx: Tx,
  programaId: string,
  usuarioId: string,
): Promise<number> {
  const r = await tx
    .updateTable("sustentabilidade.programa_links")
    .set({ desligado_em: sql<string>`now()`, desligado_por: usuarioId })
    .where("programa_id", "=", programaId)
    .where("desligado_em", "is", null)
    .returning("id")
    .execute();
  return r.length;
}

export async function criarLink(
  tx: Tx,
  programaId: string,
  tokenHash: string,
  usuarioId: string,
): Promise<void> {
  await tx
    .insertInto("sustentabilidade.programa_links")
    .values({
      programa_id: programaId,
      token_hash: tokenHash,
      criado_por: usuarioId,
    })
    .execute();
}

/** O link pelo hash do token, com o programa (service role). */
export function linkPeloHash(tx: Tx, hash: string) {
  return tx
    .selectFrom("sustentabilidade.programa_links as l")
    .innerJoin("sustentabilidade.programas as p", "p.id", "l.programa_id")
    .select([
      "l.id",
      "l.programa_id",
      "l.token_hash",
      "l.desligado_em",
      "p.nome",
      "p.ativo",
    ])
    .where("l.token_hash", "=", hash)
    .executeTakeFirst();
}

export async function marcarAcesso(tx: Tx, linkId: string): Promise<void> {
  await tx
    .updateTable("sustentabilidade.programa_links")
    .set({ ultimo_acesso_em: sql<string>`now()` })
    .where("id", "=", linkId)
    .execute();
}
