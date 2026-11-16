import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Ciclos do banco de horas: os fechados ficam em rh.banco_horas_ciclos e a
// lista por pessoa em rh.banco_horas_fechamentos. O RLS pede o custo (ver os
// ciclos), o custo individual (ver a lista) e rh.pode_fechar_banco()
// (parâmetros + custo individual) para gravar.

/** Ciclos fechados (em revisão ou finalizados), do mais novo ao mais antigo. */
export function ciclos(tx: Tx) {
  return tx
    .selectFrom("rh.banco_horas_ciclos")
    .select([
      "id",
      "inicio",
      "fim",
      "finalizado_em",
      "finalizado_por",
      "total_saldo_min",
      "total_calculado",
      "total_realizado",
    ])
    .orderBy("inicio", "desc")
    .execute();
}

export function ciclo(tx: Tx, id: string) {
  return tx
    .selectFrom("rh.banco_horas_ciclos")
    .select(["fim", "finalizado_em"])
    .where("id", "=", id)
    .executeTakeFirst();
}

/** Lista por pessoa de um ciclo. */
export function fechamentos(tx: Tx, cicloId: string) {
  return tx
    .selectFrom("rh.banco_horas_fechamentos as f")
    .leftJoin("rh.colaboradores as c", "c.id", "f.colaborador_id")
    .leftJoin("rh.departamentos as d", "d.id", "c.departamento_id")
    .select([
      "f.colaborador_id",
      "f.saldo_min",
      "f.salario_hora",
      "f.valor_calculado",
      "f.acao",
      "f.valor_realizado",
      "c.nome",
      "d.nome as departamento",
    ])
    .where("f.ciclo_id", "=", cicloId)
    .orderBy("f.colaborador_id")
    .execute();
}

/** Folhas das competências. */
export function folhasDe(tx: Tx, competencias: string[]) {
  return tx
    .selectFrom("rh.folhas")
    .select("id")
    .where("competencia", "in", competencias)
    .execute();
}

/** Rubricas das folhas, com o grupo. */
export function rubricasDasFolhas(tx: Tx, folhaIds: string[]) {
  return tx
    .selectFrom("rh.folha_rubricas as r")
    .leftJoin("rh.rubricas as b", "b.codigo", "r.rubrica_codigo")
    .select([
      "r.colaborador_id",
      "r.rubrica_codigo",
      "r.natureza",
      "r.valor",
      "b.grupo",
    ])
    .where("r.folha_id", "in", folhaIds)
    .orderBy("r.id")
    .execute();
}

/** Saldo do banco em cada dia do trecho (ponto do dia). */
export function saldosDosDias(tx: Tx, de: string, ate: string) {
  return tx
    .selectFrom("rh.ponto_diario")
    .select(["colaborador_id", "data", "banco_saldo_min"])
    .where("data", ">=", de)
    .where("data", "<=", ate)
    .orderBy("colaborador_id")
    .orderBy("data")
    .execute();
}

/** Apaga a lista ainda não finalizada do ciclo (refazer). */
export function apagarCicloAberto(tx: Tx, inicio: string) {
  return tx
    .deleteFrom("rh.banco_horas_ciclos")
    .where("inicio", "=", inicio)
    .where("finalizado_em", "is", null)
    .execute();
}

export function criarCiclo(tx: Tx, inicio: string, fim: string) {
  return tx
    .insertInto("rh.banco_horas_ciclos")
    .values({ inicio, fim })
    .returning("id")
    .executeTakeFirstOrThrow();
}

export function gravarFechamentos(
  tx: Tx,
  linhas: {
    ciclo_id: string;
    colaborador_id: string;
    saldo_min: number;
    salario_hora: number | null;
    valor_calculado: number | null;
    acao: string | null;
  }[],
) {
  if (!linhas.length) return Promise.resolve([]);
  return tx.insertInto("rh.banco_horas_fechamentos").values(linhas).execute();
}

export function atualizarFechamento(
  tx: Tx,
  cicloId: string,
  colaboradorId: string,
  valores: { acao?: string | null; valor_realizado: number | null },
) {
  return tx
    .updateTable("rh.banco_horas_fechamentos")
    .set(valores)
    .where("ciclo_id", "=", cicloId)
    .where("colaborador_id", "=", colaboradorId)
    .execute();
}

/** Quem ainda está com o realizado vazio ("pela folha"). */
export function pendentes(tx: Tx, cicloId: string) {
  return tx
    .selectFrom("rh.banco_horas_fechamentos")
    .select("colaborador_id")
    .where("ciclo_id", "=", cicloId)
    .where("valor_realizado", "is", null)
    .execute();
}

/** Guarda os totais, a data e quem finalizou, e abre o próximo ciclo. */
export function finalizar(tx: Tx, cicloId: string) {
  return sql`select rh.finalizar_ciclo_banco(p_ciclo => ${cicloId}::uuid)`.execute(
    tx,
  );
}
