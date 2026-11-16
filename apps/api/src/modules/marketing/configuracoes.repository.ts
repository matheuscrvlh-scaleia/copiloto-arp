import type { Insertable, Updateable } from "kysely";
import type { Tx } from "@/infra/banco";
import type {
  CoreMetas,
  MarketingBenchmark,
  MarketingLandingPages,
  MarketingLocatarios,
  MarketingParametros,
  MarketingRegrasAlerta,
  MarketingRondaCodigos,
  MarketingTemas,
} from "@/infra/banco/tipos";

// Gravações dos cadastros de Configurações do Marketing. Rodam com a sessão
// (o RLS confere marketing.parametros e o gatilho registra a auditoria).

export function nomesDosLocatarios(tx: Tx) {
  return tx.selectFrom("marketing.locatarios").select(["id", "nome"]).execute();
}

export function locatariosDaCarga(tx: Tx) {
  return tx
    .selectFrom("marketing.locatarios")
    .select(["id", "nome", "ativo", "entrada_em"])
    .execute();
}

export async function incluirLocatarios(
  tx: Tx,
  linhas: Insertable<MarketingLocatarios>[],
) {
  if (linhas.length)
    await tx.insertInto("marketing.locatarios").values(linhas).execute();
}

export async function alterarLocatario(
  tx: Tx,
  id: string,
  valores: Updateable<MarketingLocatarios>,
) {
  if (Object.keys(valores).length)
    await tx
      .updateTable("marketing.locatarios")
      .set(valores)
      .where("id", "=", id)
      .execute();
}

export async function removerLocatario(tx: Tx, id: string) {
  await tx.deleteFrom("marketing.locatarios").where("id", "=", id).execute();
}

/** Upsert pelo identificador (o interesse de uma landing page do RD). */
export async function gravarLandingPage(
  tx: Tx,
  lp: { identificador: string; nome: string; interesse: string },
) {
  await tx
    .insertInto("marketing.landing_pages")
    .values(lp)
    .onConflict((oc) =>
      oc
        .column("identificador")
        .doUpdateSet({ nome: lp.nome, interesse: lp.interesse }),
    )
    .execute();
}

export async function incluirLandingPage(
  tx: Tx,
  lp: Insertable<MarketingLandingPages>,
) {
  await tx.insertInto("marketing.landing_pages").values(lp).execute();
}

export async function alterarLandingPage(
  tx: Tx,
  identificador: string,
  valores: Updateable<MarketingLandingPages>,
) {
  if (Object.keys(valores).length)
    await tx
      .updateTable("marketing.landing_pages")
      .set(valores)
      .where("identificador", "=", identificador)
      .execute();
}

export async function incluirMeta(tx: Tx, meta: Insertable<CoreMetas>) {
  await tx.insertInto("core.metas").values(meta).execute();
}

/** Meta do Marketing pelo id (com a sessão), para conferir a direção. */
export function metaDoMarketing(tx: Tx, id: string) {
  return tx
    .selectFrom("core.metas")
    .select(["id", "indicador"])
    .where("id", "=", id)
    .where("indicador", "like", "marketing.%")
    .executeTakeFirst();
}

export async function alterarMeta(
  tx: Tx,
  id: string,
  valores: Updateable<CoreMetas>,
) {
  if (Object.keys(valores).length)
    await tx
      .updateTable("core.metas")
      .set(valores)
      .where("id", "=", id)
      .where("indicador", "like", "marketing.%")
      .execute();
}

export async function removerMeta(tx: Tx, id: string) {
  await tx
    .deleteFrom("core.metas")
    .where("id", "=", id)
    .where("indicador", "like", "marketing.%")
    .execute();
}

export async function alterarRegra(
  tx: Tx,
  regra: string,
  valores: Updateable<MarketingRegrasAlerta>,
) {
  if (Object.keys(valores).length)
    await tx
      .updateTable("marketing.regras_alerta")
      .set(valores)
      .where("regra", "=", regra)
      .execute();
}

export async function alterarParametros(
  tx: Tx,
  valores: Updateable<MarketingParametros>,
) {
  if (Object.keys(valores).length)
    await tx
      .updateTable("marketing.parametros")
      .set(valores)
      .where("id", "=", true)
      .execute();
}

export async function incluirTema(tx: Tx, tema: Insertable<MarketingTemas>) {
  await tx.insertInto("marketing.temas").values(tema).execute();
}

export async function alterarTema(
  tx: Tx,
  id: string,
  valores: Updateable<MarketingTemas>,
) {
  if (Object.keys(valores).length)
    await tx
      .updateTable("marketing.temas")
      .set(valores)
      .where("id", "=", id)
      .execute();
}

export async function incluirCodigoRonda(
  tx: Tx,
  c: Insertable<MarketingRondaCodigos>,
) {
  await tx.insertInto("marketing.ronda_codigos").values(c).execute();
}

export async function alterarCodigoRonda(
  tx: Tx,
  codigo: string,
  valores: Updateable<MarketingRondaCodigos>,
) {
  if (Object.keys(valores).length)
    await tx
      .updateTable("marketing.ronda_codigos")
      .set(valores)
      .where("codigo", "=", codigo)
      .execute();
}

export async function removerCodigoRonda(tx: Tx, codigo: string) {
  await tx
    .deleteFrom("marketing.ronda_codigos")
    .where("codigo", "=", codigo)
    .execute();
}

export async function incluirReferencia(
  tx: Tx,
  r: Insertable<MarketingBenchmark>,
) {
  await tx.insertInto("marketing.benchmark").values(r).execute();
}

export async function alterarReferencia(
  tx: Tx,
  id: string,
  valores: Updateable<MarketingBenchmark>,
) {
  if (Object.keys(valores).length)
    await tx
      .updateTable("marketing.benchmark")
      .set(valores)
      .where("id", "=", id)
      .execute();
}

export async function removerReferencia(tx: Tx, id: string) {
  await tx.deleteFrom("marketing.benchmark").where("id", "=", id).execute();
}

/** O "voltar" de uma inclusão: apaga a linha pela chave da tabela. */
export async function apagarDaTabela(tx: Tx, tabela: string, chave: string) {
  switch (tabela) {
    case "core.metas":
      return removerMeta(tx, chave);
    case "marketing.locatarios":
      return removerLocatario(tx, chave);
    case "marketing.landing_pages":
      await tx
        .deleteFrom("marketing.landing_pages")
        .where("identificador", "=", chave)
        .execute();
      return;
    case "marketing.temas":
      await tx.deleteFrom("marketing.temas").where("id", "=", chave).execute();
      return;
    case "marketing.benchmark":
      return removerReferencia(tx, chave);
    default:
      return removerCodigoRonda(tx, chave);
  }
}
