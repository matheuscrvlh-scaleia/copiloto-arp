import type { Tx } from "@/infra/banco";

// Consultas dos relatórios de OS que não são da lista das ordens.

/** Vigências do valor por minuto (RLS: os.custos ou os.parametros). */
export function vigencias(tx: Tx) {
  return tx
    .selectFrom("os.tecnico_valores")
    .select(["tecnico_id", "vigente_desde", "valor_minuto"])
    .orderBy("id")
    .execute();
}
