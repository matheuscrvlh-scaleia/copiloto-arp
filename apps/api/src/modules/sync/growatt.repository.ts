import type { DiaLido } from "@/connectors/growatt/client";
import type { Tx } from "@/infra/banco";

/** Grava (ou troca) a energia dos dias lidos da usina. */
export async function gravarDias(
  tx: Tx,
  usinaId: number,
  dias: DiaLido[],
  runId: string,
): Promise<void> {
  if (dias.length === 0) return;
  const agora = new Date().toISOString();
  await tx
    .insertInto("operacoes.solar_inversor_dias")
    .values(
      dias.map((d) => ({
        usina_id: usinaId,
        dia: d.dia,
        energia_kwh: d.kwh,
        sync_run_id: runId,
        atualizado_em: agora,
      })),
    )
    .onConflict((oc) =>
      oc.columns(["usina_id", "dia"]).doUpdateSet((eb) => ({
        energia_kwh: eb.ref("excluded.energia_kwh"),
        sync_run_id: eb.ref("excluded.sync_run_id"),
        atualizado_em: eb.ref("excluded.atualizado_em"),
      })),
    )
    .execute();
}

/** Há algum dia gravado desta usina? (Senão, a leitura busca o histórico.) */
export async function temDias(tx: Tx, usinaId: number): Promise<boolean> {
  const r = await tx
    .selectFrom("operacoes.solar_inversor_dias")
    .select("dia")
    .where("usina_id", "=", usinaId)
    .limit(1)
    .executeTakeFirst();
  return r !== undefined;
}
