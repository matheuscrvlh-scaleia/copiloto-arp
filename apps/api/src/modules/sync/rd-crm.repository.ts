import type { Tx } from "@/infra/banco";

export function gravarOportunidades(
  tx: Tx,
  linhas: {
    id: string;
    dados: string;
    contatos: string;
    atualizado_em: string;
  }[],
) {
  return tx
    .insertInto("comercial.rd_oportunidades")
    .values(linhas)
    .onConflict((oc) =>
      oc.column("id").doUpdateSet((eb) => ({
        dados: eb.ref("excluded.dados"),
        contatos: eb.ref("excluded.contatos"),
        atualizado_em: eb.ref("excluded.atualizado_em"),
      })),
    )
    .execute();
}

/** Apagadas no RD: tudo que a leitura de `agora` não regravou. */
export function removerAntigas(tx: Tx, agora: string) {
  return tx
    .deleteFrom("comercial.rd_oportunidades")
    .where("atualizado_em", "<", agora)
    .execute();
}
