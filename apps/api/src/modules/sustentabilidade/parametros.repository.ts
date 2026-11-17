import { type Insertable, sql, type Updateable } from "kysely";
import type { Tx } from "@/infra/banco";
import type {
  CoreDirecaoMeta,
  SustentabilidadeColetores,
  SustentabilidadeParametros,
} from "@/infra/banco/tipos";

// Consultas de Configurações › Parâmetros e › Coletores do Sustentabilidade.

// ---------------------------------------------------------------- histórico

export function setoresAtivos(tx: Tx) {
  return tx
    .selectFrom("os.setores")
    .select(["id", "nome"])
    .where("ativo", "=", true)
    .orderBy("ordem")
    .orderBy("nome")
    .execute();
}

const COLUNAS_DA_AUDITORIA = [
  "id",
  "tabela",
  "acao",
  "antes",
  "depois",
  "usuario_id",
  "em",
] as const;

export function auditoriaDasTabelas(tx: Tx, tabelas: string[], limite: number) {
  if (!tabelas.length) return Promise.resolve([]);
  return tx
    .selectFrom("core.auditoria")
    .select(COLUNAS_DA_AUDITORIA)
    .where("tabela", "in", tabelas)
    .orderBy("em", "desc")
    .orderBy("id", "desc")
    .limit(limite)
    .execute();
}

/** Metas de todos os módulos moram em core.metas: só as sustentabilidade.*. */
export function auditoriaDasMetas(
  tx: Tx,
  lado: "antes" | "depois",
  limite: number,
) {
  return tx
    .selectFrom("core.auditoria")
    .select(COLUNAS_DA_AUDITORIA)
    .where("tabela", "=", "core.metas")
    .where(
      lado === "antes"
        ? sql<boolean>`antes->>'indicador' like 'sustentabilidade.%'`
        : sql<boolean>`depois->>'indicador' like 'sustentabilidade.%'`,
    )
    .orderBy("em", "desc")
    .limit(limite)
    .execute();
}

/** Tabelas que sustentabilidade.remover_exemplos() limpa. */
export type TabelaComExemplo =
  | "contratos"
  | "programas"
  | "formularios"
  | "lancamentos"
  | "participantes"
  | "coletores"
  | "rondas"
  | "rcc_notas"
  | "rcc_precos"
  | "marcos";

export async function linhasDeExemplo(
  tx: Tx,
  tabela: TabelaComExemplo,
): Promise<number> {
  const r = await tx
    .selectFrom(`sustentabilidade.${tabela}`)
    .select((eb) => eb.fn.countAll<number>().as("total"))
    .where("exemplo", "=", true)
    .executeTakeFirst();
  return Number(r?.total ?? 0);
}

// ---------------------------------------------------------- tabelas de apoio

export function fatoresDoRcc(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.rcc_fatores")
    .select(["vigente_desde", "toneladas_por_cacamba", "volume_m3"])
    .orderBy("vigente_desde", "desc")
    .execute();
}

export function fatoresDeCo2(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.co2_fatores")
    .select(["vigente_desde", "kg_por_kwh"])
    .orderBy("vigente_desde", "desc")
    .execute();
}

export function precosDoRcc(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.rcc_precos")
    .select(["vigente_desde", "preco_a", "preco_b"])
    .execute();
}

export function custosDoTour(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.parametros_valores")
    .select(["tour_custo_album", "tour_custo_copo"])
    .where("id", "=", true)
    .executeTakeFirst();
}

export function marcos(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.marcos")
    .select(["indicador", "ano", "valor", "exemplo"])
    .orderBy("indicador")
    .orderBy("ano")
    .execute();
}

export function equivalencias(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.equivalencias")
    .select(["nome", "fator", "unidade", "confirmado"])
    .orderBy("nome")
    .execute();
}

export function metasDoAno(tx: Tx, desde: string, indicadores: string[]) {
  if (!indicadores.length) return Promise.resolve([]);
  return tx
    .selectFrom("core.metas")
    .select(["id", "indicador", "meta"])
    .where("vigente_desde", "=", desde)
    .where("indicador", "in", indicadores)
    .execute();
}

// ---------------------------------------------------------------- gravações

export async function atualizarParametros(
  tx: Tx,
  campos: Updateable<SustentabilidadeParametros>,
): Promise<boolean> {
  const r = await tx
    .updateTable("sustentabilidade.parametros")
    .set(campos)
    .where("id", "=", true)
    .executeTakeFirst();
  return r.numUpdatedRows > 0n;
}

export async function atualizarCustosDoTour(
  tx: Tx,
  custos: { tour_custo_album: number; tour_custo_copo: number },
): Promise<boolean> {
  const r = await tx
    .updateTable("sustentabilidade.parametros_valores")
    .set(custos)
    .where("id", "=", true)
    .executeTakeFirst();
  return r.numUpdatedRows > 0n;
}

export async function apagarValidades(tx: Tx, setores: string[]) {
  if (!setores.length) return;
  await tx
    .deleteFrom("sustentabilidade.setor_validades")
    .where("setor", "in", setores)
    .execute();
}

export async function atualizarValidade(tx: Tx, setor: string, meses: number) {
  await tx
    .updateTable("sustentabilidade.setor_validades")
    .set({ meses })
    .where("setor", "=", setor)
    .execute();
}

export async function inserirValidades(
  tx: Tx,
  linhas: { setor: string; meses: number }[],
) {
  if (!linhas.length) return;
  await tx
    .insertInto("sustentabilidade.setor_validades")
    .values(linhas)
    .execute();
}

export function marcosSemExemplo(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.marcos")
    .select(["indicador", "ano", "valor"])
    .execute();
}

export async function apagarMarco(tx: Tx, indicador: string, ano: number) {
  await tx
    .deleteFrom("sustentabilidade.marcos")
    .where("indicador", "=", indicador)
    .where("ano", "=", ano)
    .execute();
}

export async function atualizarMarco(
  tx: Tx,
  m: { indicador: string; ano: number; valor: number },
) {
  await tx
    .updateTable("sustentabilidade.marcos")
    .set({ valor: m.valor })
    .where("indicador", "=", m.indicador)
    .where("ano", "=", m.ano)
    .execute();
}

export async function inserirMarcos(
  tx: Tx,
  linhas: { indicador: string; ano: number; valor: number }[],
) {
  if (!linhas.length) return;
  await tx.insertInto("sustentabilidade.marcos").values(linhas).execute();
}

export async function apagarEquivalencias(tx: Tx, nomes: string[]) {
  if (!nomes.length) return;
  await tx
    .deleteFrom("sustentabilidade.equivalencias")
    .where("nome", "in", nomes)
    .execute();
}

export interface Equivalencia {
  nome: string;
  fator: number;
  unidade: string | null;
  confirmado: boolean;
}

export async function atualizarEquivalencia(tx: Tx, l: Equivalencia) {
  await tx
    .updateTable("sustentabilidade.equivalencias")
    .set({ fator: l.fator, unidade: l.unidade, confirmado: l.confirmado })
    .where("nome", "=", l.nome)
    .execute();
}

export async function inserirEquivalencias(tx: Tx, linhas: Equivalencia[]) {
  if (!linhas.length) return;
  await tx
    .insertInto("sustentabilidade.equivalencias")
    .values(linhas)
    .execute();
}

export async function gravarMetas(
  tx: Tx,
  linhas: {
    indicador: string;
    direcao: CoreDirecaoMeta;
    meta: number;
    vigente_desde: string;
  }[],
) {
  if (!linhas.length) return;
  await tx
    .insertInto("core.metas")
    .values(linhas)
    .onConflict((oc) =>
      oc.columns(["indicador", "vigente_desde"]).doUpdateSet((eb) => ({
        direcao: eb.ref("excluded.direcao"),
        meta: eb.ref("excluded.meta"),
      })),
    )
    .execute();
}

export async function apagarMetas(tx: Tx, ids: string[]) {
  if (!ids.length) return;
  await tx
    .deleteFrom("core.metas")
    .where("id", "in", ids)
    .where("indicador", "like", "sustentabilidade.%")
    .execute();
}

export async function inserirFatorDoRcc(
  tx: Tx,
  linha: {
    vigente_desde: string;
    toneladas_por_cacamba: number;
    volume_m3: number;
    criado_por: string;
  },
) {
  await tx.insertInto("sustentabilidade.rcc_fatores").values(linha).execute();
}

export async function inserirFatorDeCo2(
  tx: Tx,
  linha: { vigente_desde: string; kg_por_kwh: number; criado_por: string },
) {
  await tx.insertInto("sustentabilidade.co2_fatores").values(linha).execute();
}

export async function inserirPrecoDoRcc(
  tx: Tx,
  linha: {
    vigente_desde: string;
    preco_a: number;
    preco_b: number;
    criado_por: string;
  },
) {
  await tx.insertInto("sustentabilidade.rcc_precos").values(linha).execute();
}

export async function removerExemplos(tx: Tx) {
  await sql`select sustentabilidade.remover_exemplos()`.execute(tx);
}

// ---------------------------------------------------------------- coletores

type CamposDoColetor = Pick<
  Insertable<SustentabilidadeColetores>,
  "local" | "cor" | "conteineres" | "capacidade_l" | "ordem" | "ativo"
>;

export async function inserirColetor(
  tx: Tx,
  campos: CamposDoColetor,
): Promise<boolean> {
  const r = await tx
    .insertInto("sustentabilidade.coletores")
    .values(campos)
    .returning("id")
    .executeTakeFirst();
  return Boolean(r);
}

export async function atualizarColetor(
  tx: Tx,
  id: string,
  campos: CamposDoColetor,
): Promise<boolean> {
  const r = await tx
    .updateTable("sustentabilidade.coletores")
    .set(campos)
    .where("id", "=", id)
    .returning("id")
    .executeTakeFirst();
  return Boolean(r);
}

export async function excluirColetor(
  tx: Tx,
  id: string,
): Promise<string | null> {
  const r = await tx
    .deleteFrom("sustentabilidade.coletores")
    .where("id", "=", id)
    .returning("local")
    .executeTakeFirst();
  return r?.local ?? null;
}
