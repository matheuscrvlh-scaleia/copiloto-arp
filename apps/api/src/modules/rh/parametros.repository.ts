import type { Tx } from "@/infra/banco";

// Consultas da tela de Parâmetros que não são da base do módulo.

/** Jornadas, da vigência mais nova (há uma por funcionário). */
export function jornadas(tx: Tx) {
  return tx
    .selectFrom("rh.jornadas")
    .select([
      "departamento_id",
      "cargo_id",
      "colaborador_id",
      "horas_mes_min",
      "vigente_desde",
    ])
    .orderBy("vigente_desde", "desc")
    .orderBy("id")
    .execute();
}

/** Todos os colaboradores, desde sempre. */
export function colaboradores(tx: Tx) {
  return tx
    .selectFrom("rh.colaboradores")
    .select(["id", "nome", "desligamento"])
    .orderBy("nome")
    .orderBy("id")
    .execute();
}

/** As 30 últimas alterações auditadas. */
export function auditoria(tx: Tx) {
  return tx
    .selectFrom("core.auditoria")
    .select(["id", "tabela", "registro_id", "acao", "usuario_id", "em"])
    .orderBy("em", "desc")
    .limit(30)
    .execute();
}
