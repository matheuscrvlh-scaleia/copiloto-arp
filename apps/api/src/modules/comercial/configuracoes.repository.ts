import { sql, type Updateable } from "kysely";
import type { Tx } from "@/infra/banco";
import type { DB, Json } from "@/infra/banco/tipos";

// Consultas e gravações de Comercial › Configurações. Tudo com a sessão: o
// RLS confere comercial.parametros.editar e core.auditoria registra quem,
// quando, antes e depois.

const COLUNAS_AUDITORIA = [
  "id",
  "tabela",
  "registro_id",
  "acao",
  "antes",
  "depois",
  "usuario_id",
  "em",
] as const;

export function auditoria(tx: Tx, tabelas: string[], limite: number) {
  if (!tabelas.length) return Promise.resolve([]);
  return tx
    .selectFrom("core.auditoria")
    .select(COLUNAS_AUDITORIA)
    .where("tabela", "in", tabelas)
    .orderBy("em", "desc")
    .orderBy("id", "desc")
    .limit(limite)
    .execute();
}

/** Alterações das metas do Comercial (indicador comercial.*). */
export function auditoriaDasMetas(tx: Tx, limite: number) {
  return tx
    .selectFrom("core.auditoria")
    .select(COLUNAS_AUDITORIA)
    .where("tabela", "=", "core.metas")
    .where(
      sql<boolean>`(depois ->> 'indicador' like 'comercial.%' or antes ->> 'indicador' like 'comercial.%')`,
    )
    .orderBy("em", "desc")
    .orderBy("id", "desc")
    .limit(limite)
    .execute();
}

export function feriados(tx: Tx) {
  return tx
    .selectFrom("os.feriados")
    .select(["data", "nome"])
    .orderBy("data")
    .execute();
}

export function atualizarParametros(
  tx: Tx,
  patch: Updateable<DB["comercial.parametros"]>,
) {
  return tx
    .updateTable("comercial.parametros")
    .set(patch)
    .where("id", "=", true)
    .execute();
}

export function itensDaLista(tx: Tx, lista: string) {
  return tx
    .selectFrom("comercial.listas")
    .select(["id", "valor", "ordem", "ativo", "extra"])
    .where("lista", "=", lista)
    .execute();
}

export async function desativarItens(tx: Tx, ids: string[]) {
  if (!ids.length) return;
  await tx
    .updateTable("comercial.listas")
    .set({ ativo: false })
    .where("id", "in", ids)
    .execute();
}

export function atualizarItem(
  tx: Tx,
  id: string,
  item: { ordem: number; extra: unknown },
) {
  return tx
    .updateTable("comercial.listas")
    .set({ ordem: item.ordem, ativo: true, extra: JSON.stringify(item.extra) })
    .where("id", "=", id)
    .execute();
}

export async function incluirItens(
  tx: Tx,
  lista: string,
  itens: { valor: string; ordem: number; extra: unknown }[],
) {
  if (!itens.length) return;
  await tx
    .insertInto("comercial.listas")
    .values(
      itens.map((i) => ({
        lista,
        valor: i.valor,
        ordem: i.ordem,
        extra: JSON.stringify(i.extra),
      })),
    )
    .execute();
}

export function dePara(tx: Tx) {
  return tx
    .selectFrom("comercial.fontes_de_para")
    .select(["fonte_rd", "fonte_ajustada"])
    .execute();
}

export async function gravarDePara(
  tx: Tx,
  linhas: { fonte_rd: string; fonte_ajustada: string }[],
) {
  if (!linhas.length) return;
  await tx
    .insertInto("comercial.fontes_de_para")
    .values(linhas)
    .onConflict((oc) =>
      oc.column("fonte_rd").doUpdateSet((eb) => ({
        fonte_ajustada: eb.ref("excluded.fonte_ajustada"),
      })),
    )
    .execute();
}

export function incluirDePara(
  tx: Tx,
  linha: { fonte_rd: string; fonte_ajustada: string },
) {
  return tx.insertInto("comercial.fontes_de_para").values(linha).execute();
}

export function removerDePara(tx: Tx, fonte: string) {
  return tx
    .deleteFrom("comercial.fontes_de_para")
    .where("fonte_rd", "=", fonte)
    .execute();
}

export function tiposLuc(tx: Tx) {
  return tx
    .selectFrom("comercial.tipos_luc")
    .select(["tipo", "conta_ocupacao", "ordem"])
    .execute();
}

export function marcarTipoLuc(tx: Tx, tipo: string, conta: boolean) {
  return tx
    .updateTable("comercial.tipos_luc")
    .set({ conta_ocupacao: conta })
    .where("tipo", "=", tipo)
    .execute();
}

export function incluirTipoLuc(
  tx: Tx,
  t: { tipo: string; conta_ocupacao: boolean; ordem: number },
) {
  return tx.insertInto("comercial.tipos_luc").values(t).execute();
}

export function faixas(tx: Tx) {
  return tx
    .selectFrom("comercial.faixas_evento")
    .select([
      "id",
      "nome",
      "ordem",
      "area_de",
      "area_ate",
      "fixo",
      "valor_comum",
      "valor_sazonal",
    ])
    .execute();
}

interface FaixaGravada {
  nome: string;
  area_de: number;
  area_ate: number;
  fixo: boolean;
  valor_comum: number;
  valor_sazonal: number;
}

export function alterarFaixa(tx: Tx, id: string, f: FaixaGravada) {
  return tx
    .updateTable("comercial.faixas_evento")
    .set(f)
    .where("id", "=", id)
    .execute();
}

export function incluirFaixa(tx: Tx, f: FaixaGravada & { ordem: number }) {
  return tx.insertInto("comercial.faixas_evento").values(f).execute();
}

export function removerFaixa(tx: Tx, id: string) {
  return tx
    .deleteFrom("comercial.faixas_evento")
    .where("id", "=", id)
    .execute();
}

export function gravarFeriado(tx: Tx, f: { data: string; nome: string }) {
  return tx
    .insertInto("os.feriados")
    .values(f)
    .onConflict((oc) =>
      oc
        .column("data")
        .doUpdateSet((eb) => ({ nome: eb.ref("excluded.nome") })),
    )
    .execute();
}

export function removerFeriado(tx: Tx, data: string) {
  return tx
    .deleteFrom("os.feriados")
    .where("data", "=", data)
    .returning("data")
    .execute();
}

export type { Json };
