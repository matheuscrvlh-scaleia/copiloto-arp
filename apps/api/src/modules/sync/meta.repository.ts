import type { Tx } from "@/infra/banco";

// marketing.redes_dia: seguidores do dia e métricas diárias do Instagram.

export function gravarSeguidores(
  tx: Tx,
  linha: { rede: string; dia: string; seguidores: number },
) {
  return tx
    .insertInto("marketing.redes_dia")
    .values(linha)
    .onConflict((oc) =>
      oc.columns(["rede", "dia"]).doUpdateSet((eb) => ({
        seguidores: eb.ref("excluded.seguidores"),
      })),
    )
    .execute();
}

/** Dias do Instagram que já têm as métricas, desde `desde`. */
export async function diasComMetricas(
  tx: Tx,
  desde: string,
): Promise<string[]> {
  const r = await tx
    .selectFrom("marketing.redes_dia")
    .select("dia")
    .where("rede", "=", "instagram")
    .where("alcance", "is not", null)
    .where("dia", ">=", desde)
    .execute();
  return r.map((d) => d.dia);
}

export interface MetricasDoDia {
  rede: string;
  dia: string;
  alcance: number;
  visualizacoes: number;
  contas_engajadas: number;
  interacoes: number;
  toques_links: number;
  atualizado_em: string;
}

export function gravarMetricas(tx: Tx, linhas: MetricasDoDia[]) {
  return tx
    .insertInto("marketing.redes_dia")
    .values(linhas)
    .onConflict((oc) =>
      oc.columns(["rede", "dia"]).doUpdateSet((eb) => ({
        alcance: eb.ref("excluded.alcance"),
        visualizacoes: eb.ref("excluded.visualizacoes"),
        contas_engajadas: eb.ref("excluded.contas_engajadas"),
        interacoes: eb.ref("excluded.interacoes"),
        toques_links: eb.ref("excluded.toques_links"),
        atualizado_em: eb.ref("excluded.atualizado_em"),
      })),
    )
    .execute();
}
