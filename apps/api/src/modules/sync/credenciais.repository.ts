import type { Tx } from "@/infra/banco";

export function credencial(tx: Tx, sistema: string) {
  return tx
    .selectFrom("integracao.credenciais")
    .select(["parametros", "segredo_cifrado", "ativa"])
    .where("sistema", "=", sistema)
    .executeTakeFirst();
}

/** Troca só o segredo (o RD Station CRM renova o refresh token a cada uso). */
export function trocarSegredo(tx: Tx, sistema: string, segredoCifrado: string) {
  return tx
    .updateTable("integracao.credenciais")
    .set({ segredo_cifrado: segredoCifrado })
    .where("sistema", "=", sistema)
    .execute();
}
