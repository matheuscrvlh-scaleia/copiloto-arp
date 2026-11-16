import type { EntradaEmpresa } from "@arp/shared/admin/contratos";
import type { Tx } from "@/infra/banco";

// core.empresa tem uma linha só (id = true). O RLS deixa toda pessoa logada
// ler e só admin.empresa gravar.

export function empresa(tx: Tx) {
  return tx
    .selectFrom("core.empresa")
    .select([
      "nome",
      "razao_social",
      "cnpj",
      "email",
      "telefone",
      "site",
      "endereco",
      "cidade",
      "uf",
      "cep",
      "atualizado_em",
    ])
    .executeTakeFirst();
}

export async function salvarEmpresa(tx: Tx, d: EntradaEmpresa): Promise<void> {
  await tx.updateTable("core.empresa").set(d).where("id", "=", true).execute();
}
