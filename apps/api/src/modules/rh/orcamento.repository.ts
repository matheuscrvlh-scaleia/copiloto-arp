import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Planejamento orçamentário (orcamento.ts e acoes/orcamento.ts do antigo),
// sempre com a sessão: o RLS confere rh.orcamento / rh.orcamento.lancar e o
// banco barra gasto em ano finalizado e categoria desativada.

/** Todas as categorias (ativas e desativadas), por nome. */
export function categorias(tx: Tx) {
  return tx
    .selectFrom("rh.categorias_gasto")
    .select(["id", "nome", "ativa"])
    .orderBy("nome")
    .execute();
}

/** Orçamentos recebidos do ERP, do ano mais antigo ao mais novo. */
export function orcamentos(tx: Tx) {
  return tx
    .selectFrom("rh.orcamentos_anuais")
    .select([
      "ano",
      "valor",
      "recebido_em",
      "finalizado_em",
      "finalizado_por",
      "total_gasto",
    ])
    .orderBy("ano")
    .execute();
}

/** Gastos do ano, do mais recente para o mais antigo. */
export function gastosDoAno(tx: Tx, ano: number) {
  return tx
    .selectFrom("rh.gastos as g")
    .leftJoin("rh.categorias_gasto as c", "c.id", "g.categoria_id")
    .select([
      "g.id",
      "g.data",
      "g.valor",
      "g.categoria_id",
      "c.nome as categoria",
      "g.descricao",
      "g.finalidade",
      "g.observacao",
    ])
    .where("g.data", ">=", `${ano}-01-01`)
    .where("g.data", "<=", `${ano}-12-31`)
    .orderBy("g.data", "desc")
    .orderBy("g.id")
    .execute();
}

/** Data do primeiro gasto lançado. */
export async function primeiroGasto(tx: Tx): Promise<string | null> {
  const l = await tx
    .selectFrom("rh.gastos")
    .select("data")
    .orderBy("data")
    .limit(1)
    .executeTakeFirst();
  return l?.data ?? null;
}

export interface CamposDoGasto {
  data: string;
  valor: number;
  categoria_id: string;
  descricao: string;
  finalidade: string;
  observacao: string | null;
}

export function criarGasto(tx: Tx, g: CamposDoGasto) {
  return tx.insertInto("rh.gastos").values(g).execute();
}

export function corrigirGasto(tx: Tx, id: string, g: CamposDoGasto) {
  return tx.updateTable("rh.gastos").set(g).where("id", "=", id).execute();
}

export function excluirGasto(tx: Tx, id: string) {
  return tx.deleteFrom("rh.gastos").where("id", "=", id).execute();
}

export async function finalizar(tx: Tx, ano: number): Promise<void> {
  await sql`select rh.finalizar_orcamento(p_ano => ${ano})`.execute(tx);
}

export function criarCategoria(tx: Tx, nome: string) {
  return tx.insertInto("rh.categorias_gasto").values({ nome }).execute();
}

export function renomearCategoria(tx: Tx, id: string, nome: string) {
  return tx
    .updateTable("rh.categorias_gasto")
    .set({ nome })
    .where("id", "=", id)
    .execute();
}

export function ativarCategoria(tx: Tx, id: string, ativa: boolean) {
  return tx
    .updateTable("rh.categorias_gasto")
    .set({ ativa })
    .where("id", "=", id)
    .execute();
}
