import type { Tx } from "@/infra/banco";

// Consultas dos lançamentos dos programas (spec 4.8). Com a `tx` do
// `comoUsuario`, o RLS mostra os do programa a quem gerencia, vê o painel
// ou lança nele, e `lancamento_valores` (os campos em reais) só com "Ver
// valores" (sem ela, a junção vem nula). Com a do `comoServico` (link do
// parceiro, rotina), quem chama já conferiu o token ou o acesso.

/** Lançamentos do programa com data do fato entre `de` e `ate`. */
export function doPrograma(
  tx: Tx,
  programaId: string,
  de: string,
  ate: string,
) {
  return tx
    .selectFrom("sustentabilidade.lancamentos as l")
    .leftJoin(
      "sustentabilidade.lancamento_valores as v",
      "v.lancamento_id",
      "l.id",
    )
    .select([
      "l.id",
      "l.formulario_id",
      "l.formulario_versao",
      "l.data",
      "l.valores",
      "l.origem",
      "l.lancado_por",
      "l.criado_em",
      "l.exemplo",
      "v.valores as reais",
    ])
    .where("l.programa_id", "=", programaId)
    .where("l.data", ">=", de)
    .where("l.data", "<=", ate)
    .orderBy("l.data", "desc")
    .orderBy("l.id")
    .execute();
}

/** Lançamentos de um período (de vários programas) para os indicadores. */
export function paraIndicadores(
  tx: Tx,
  p: { de: string; ate: string; programas: string[] },
) {
  return tx
    .selectFrom("sustentabilidade.lancamentos as l")
    .leftJoin(
      "sustentabilidade.lancamento_valores as v",
      "v.lancamento_id",
      "l.id",
    )
    .select([
      "l.programa_id",
      "l.formulario_id",
      "l.data",
      "l.valores",
      "v.valores as reais",
    ])
    .where("l.programa_id", "in", p.programas)
    .where("l.data", ">=", p.de)
    .where("l.data", "<=", p.ate)
    .orderBy("l.data")
    .orderBy("l.id")
    .execute();
}

/** Um lançamento, com os campos em reais (para corrigir). */
export function lancamento(tx: Tx, id: string) {
  return tx
    .selectFrom("sustentabilidade.lancamentos as l")
    .leftJoin(
      "sustentabilidade.lancamento_valores as v",
      "v.lancamento_id",
      "l.id",
    )
    .select([
      "l.id",
      "l.programa_id",
      "l.formulario_id",
      "l.formulario_versao",
      "l.data",
      "l.valores",
      "l.exemplo",
      "l.link_id",
      "l.criado_em",
      "v.valores as reais",
    ])
    .where("l.id", "=", id)
    .executeTakeFirst();
}

/** O que um link lançou desde `desde` (página do parceiro). */
export function doLink(tx: Tx, linkId: string, desde: string) {
  return tx
    .selectFrom("sustentabilidade.lancamentos as l")
    .leftJoin(
      "sustentabilidade.lancamento_valores as v",
      "v.lancamento_id",
      "l.id",
    )
    .select([
      "l.id",
      "l.formulario_id",
      "l.formulario_versao",
      "l.data",
      "l.valores",
      "l.criado_em",
      "v.valores as reais",
    ])
    .where("l.link_id", "=", linkId)
    .where("l.criado_em", ">=", desde)
    .orderBy("l.criado_em", "desc")
    .limit(500)
    .execute();
}

export function programaAtivo(tx: Tx, id: string) {
  return tx
    .selectFrom("sustentabilidade.programas")
    .select(["nome", "ativo"])
    .where("id", "=", id)
    .executeTakeFirst();
}

// ---------------------------------------------------------------- formulários

/** Formulários ativos e publicados do programa. */
export function formulariosPublicados(tx: Tx, programaId: string) {
  return tx
    .selectFrom("sustentabilidade.formularios")
    .select(["id", "nome"])
    .where("tipo", "=", "programa")
    .where("programa_id", "=", programaId)
    .where("ativo", "=", true)
    .where("versao_publicada", ">", 0)
    .orderBy("nome")
    .execute();
}

/** Nomes de todos os formulários do programa (inclusive inativos). */
export function nomesDosFormularios(tx: Tx, programaId: string) {
  return tx
    .selectFrom("sustentabilidade.formularios")
    .select(["id", "nome"])
    .where("programa_id", "=", programaId)
    .execute();
}

/** A versão publicada mais recente de cada formulário. */
export function ultimasVersoes(tx: Tx, ids: string[]) {
  return tx
    .selectFrom("sustentabilidade.formulario_versoes")
    .select(["formulario_id", "versao", "definicao"])
    .distinctOn("formulario_id")
    .where("formulario_id", "in", ids)
    .orderBy("formulario_id")
    .orderBy("versao", "desc")
    .execute();
}

/** Todas as versões dos formulários (para achar as usadas). */
export function versoes(tx: Tx, ids: string[]) {
  return tx
    .selectFrom("sustentabilidade.formulario_versoes")
    .select(["formulario_id", "versao", "definicao"])
    .where("formulario_id", "in", ids)
    .execute();
}

export function versao(tx: Tx, formularioId: string, versao: number) {
  return tx
    .selectFrom("sustentabilidade.formulario_versoes")
    .select("definicao")
    .where("formulario_id", "=", formularioId)
    .where("versao", "=", versao)
    .executeTakeFirst();
}

// ---------------------------------------------------------------- listas e custos

export function listas(tx: Tx, programaId: string) {
  return tx
    .selectFrom("sustentabilidade.cadastros_lista")
    .select(["campo_id", "valor"])
    .where("programa_id", "=", programaId)
    .orderBy("valor")
    .orderBy("id")
    .execute();
}

export function custosDoTour(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.parametros_valores")
    .select(["tour_custo_album", "tour_custo_copo"])
    .where("id", "=", true)
    .executeTakeFirst();
}

// ---------------------------------------------------------------- gravar

export interface NovoLancamento {
  programa_id: string;
  formulario_id: string;
  formulario_versao: number;
  data: string;
  /** JSON.stringify dos valores (jsonb). */
  valores: string;
  origem: "equipe" | "link";
  link_id?: string | null;
  lancado_por?: string | null;
}

export async function inserir(tx: Tx, l: NovoLancamento): Promise<string> {
  const r = await tx
    .insertInto("sustentabilidade.lancamentos")
    .values(l)
    .returning("id")
    .executeTakeFirstOrThrow();
  return r.id;
}

export async function inserirReais(
  tx: Tx,
  lancamentoId: string,
  reais: string,
): Promise<void> {
  await tx
    .insertInto("sustentabilidade.lancamento_valores")
    .values({ lancamento_id: lancamentoId, valores: reais })
    .execute();
}

/** Corrige data e valores; devolve se mudou alguma linha. */
export async function corrigir(
  tx: Tx,
  id: string,
  c: { data: string; valores: string },
): Promise<boolean> {
  const r = await tx
    .updateTable("sustentabilidade.lancamentos")
    .set(c)
    .where("id", "=", id)
    .executeTakeFirst();
  return r.numUpdatedRows > 0n;
}

export async function gravarReais(
  tx: Tx,
  lancamentoId: string,
  reais: string,
): Promise<void> {
  await tx
    .insertInto("sustentabilidade.lancamento_valores")
    .values({ lancamento_id: lancamentoId, valores: reais })
    .onConflict((oc) =>
      oc.column("lancamento_id").doUpdateSet({ valores: reais }),
    )
    .execute();
}

export async function excluir(tx: Tx, id: string): Promise<boolean> {
  const r = await tx
    .deleteFrom("sustentabilidade.lancamentos")
    .where("id", "=", id)
    .executeTakeFirst();
  return r.numDeletedRows > 0n;
}

/** Nomes novos da "lista de cadastro" (o mesmo nome normalizado não duplica). */
export async function cadastrarNomes(
  tx: Tx,
  linhas: {
    programa_id: string;
    campo_id: string;
    valor: string;
    normalizado: string;
  }[],
): Promise<void> {
  if (!linhas.length) return;
  await tx
    .insertInto("sustentabilidade.cadastros_lista")
    .values(linhas)
    .onConflict((oc) =>
      oc.columns(["programa_id", "campo_id", "normalizado"]).doNothing(),
    )
    .execute();
}
