import type { Tx } from "@/infra/banco";

export function registrarContato(tx: Tx, deviceid: string, agora: string) {
  return tx
    .insertInto("integracao.cameras")
    .values({ deviceid, ultimo_contato: agora })
    .onConflict((oc) =>
      oc.column("deviceid").doUpdateSet((eb) => ({
        ultimo_contato: eb.ref("excluded.ultimo_contato"),
      })),
    )
    .execute();
}

/** Reenvio do mesmo período regrava a linha, sem somar de novo. */
export function gravarContagem(
  tx: Tx,
  linha: {
    deviceid: string;
    inicio: string;
    fim: string;
    entradas: number;
    saidas: number;
    recebido_em: string;
  },
) {
  return tx
    .insertInto("integracao.camera_contagens")
    .values(linha)
    .onConflict((oc) =>
      oc.columns(["deviceid", "inicio"]).doUpdateSet((eb) => ({
        fim: eb.ref("excluded.fim"),
        entradas: eb.ref("excluded.entradas"),
        saidas: eb.ref("excluded.saidas"),
        recebido_em: eb.ref("excluded.recebido_em"),
      })),
    )
    .execute();
}
