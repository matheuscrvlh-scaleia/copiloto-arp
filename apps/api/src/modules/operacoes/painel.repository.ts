import type { Tx } from "@/infra/banco";

// Consultas do Painel de Operações que não são de uma tela: contagem dos
// quadros ativos, faturas do último mês e previsto × realizado das obras.
// Com a sessão (RLS de cada área).

export function quadrosAtivos(tx: Tx) {
  return tx
    .selectFrom("operacoes.quadros")
    .select(["id", "bloco", "exemplo"])
    .where("ativo", "=", true)
    .execute();
}

export async function ultimoMesComFatura(tx: Tx): Promise<string | null> {
  const r = await tx
    .selectFrom("operacoes.energia_faturas")
    .select("referencia")
    .where("vigente", "=", true)
    .orderBy("referencia", "desc")
    .limit(1)
    .executeTakeFirst();
  return r?.referencia ?? null;
}

export function faturasDoMes(tx: Tx, referencia: string) {
  return tx
    .selectFrom("operacoes.energia_faturas")
    .select([
      "total",
      "valor_compensado",
      "compensado_kwh",
      "saldo_kwh",
      "expirar_kwh",
      "exemplo",
    ])
    .where("vigente", "=", true)
    .where("referencia", "=", referencia)
    .execute();
}

export function obrasAtivas(tx: Tx) {
  return tx
    .selectFrom("operacoes.obras")
    .select(["id", "nome", "exemplo"])
    .where("ativa", "=", true)
    .orderBy("nome")
    .execute();
}

export function revisoesVigentes(tx: Tx) {
  return tx
    .selectFrom("operacoes.orcamento_revisoes")
    .select(["id", "obra_id", "codigo", "total"])
    .where("vigente", "=", true)
    .execute();
}

export function realizado(tx: Tx) {
  return tx
    .selectFrom("operacoes.obra_realizado")
    .select(["id", "obra_id", "valor"])
    .orderBy("id")
    .execute();
}

export function etapasDasRevisoes(tx: Tx, revisoes: string[]) {
  return tx
    .selectFrom("operacoes.orcamento_etapas")
    .select(["id", "revisao_id"])
    .where("revisao_id", "in", revisoes)
    .orderBy("id")
    .execute();
}

/** Previsto das etapas até o mês (inclusive). */
export function previstoAte(tx: Tx, etapas: string[], mes: string) {
  return tx
    .selectFrom("operacoes.orcamento_previsto")
    .select(["etapa_id", "mes", "valor"])
    .where("etapa_id", "in", etapas)
    .where("mes", "<=", mes)
    .orderBy("etapa_id")
    .orderBy("mes")
    .execute();
}
