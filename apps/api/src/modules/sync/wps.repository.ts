import { sql } from "kysely";
import type { Tx } from "@/infra/banco";
import type { DiaEstacionamento } from "./wps.regras";

/** Troca de uma vez os dias lidos (pagamentos e movimento) do estacionamento. */
export function gravarEstacionamento(
  tx: Tx,
  estacionamentoId: number,
  dias: DiaEstacionamento[],
  runId: string,
) {
  return sql`
    select financeiro.gravar_estacionamento(
      p_estacionamento_id => ${estacionamentoId}::int,
      p_dias => ${JSON.stringify(dias)}::jsonb,
      p_sync_run_id => ${runId}::uuid
    )
  `.execute(tx);
}
