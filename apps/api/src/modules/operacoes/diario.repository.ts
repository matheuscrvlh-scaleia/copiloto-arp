import type { Tx } from "@/infra/banco";

// Consultas do Diário de Obra (cópia da API do aplicativo) usadas pelo
// Painel. Com a sessão (RLS: operacoes.obras.diario). A parte B (telas do
// Diário) completa este arquivo.

/** Todas as obras do aplicativo (poucas: lidas inteiras). */
export function obras(tx: Tx) {
  return tx
    .selectFrom("operacoes.diario_obras")
    .select([
      "id",
      "nome",
      "status_id",
      "grupo",
      "responsavel",
      "data_inicio",
      "data_fim",
      "prazo_contratual",
      "prazo_decorrido",
      "prazo_a_vencer",
      "realizado",
      "tarefas",
      "dados",
      "exemplo",
    ])
    .orderBy("nome")
    .orderBy("id")
    .execute();
}
export type LinhaDaObra = Awaited<ReturnType<typeof obras>>[number];

/** Datas e status de todos os relatórios. */
export function datasDosRelatorios(tx: Tx) {
  return tx
    .selectFrom("operacoes.diario_relatorios")
    .select(["id", "obra_id", "numero", "data", "data_fim", "status_id"])
    .orderBy("data")
    .orderBy("id")
    .execute();
}

/** Quando a sincronização gravou a obra mais recente. */
export async function ultimaAtualizacao(tx: Tx): Promise<string | null> {
  const r = await tx
    .selectFrom("operacoes.diario_obras")
    .select("atualizado_em")
    .orderBy("atualizado_em", "desc")
    .limit(1)
    .executeTakeFirst();
  return r?.atualizado_em ?? null;
}
