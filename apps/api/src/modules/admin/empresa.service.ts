import type { Empresa, EntradaEmpresa } from "@arp/shared/admin/contratos";
import type { Contexto } from "@/contexto";
import { banco } from "@/infra/banco";
import * as repo from "./empresa.repository";

// Dados da empresa: toda pessoa logada lê (o nome aparece no Dashboard);
// a gravação passa pelo RLS (admin.empresa) e cai na auditoria.

export async function empresa(ctx: Contexto): Promise<Empresa | null> {
  return (
    (await banco.comoUsuario(ctx.usuario.id, (tx) => repo.empresa(tx))) ?? null
  );
}

export async function salvarEmpresa(
  ctx: Contexto,
  d: EntradaEmpresa,
): Promise<void> {
  await banco.comoUsuario(ctx.usuario.id, (tx) => repo.salvarEmpresa(tx, d));
}
