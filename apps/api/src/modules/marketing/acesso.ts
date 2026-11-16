import { hojeEmBrasilia } from "@arp/shared/os/tempo";
import type { Permissao } from "@arp/shared/permissions";
import { type Contexto, exigir } from "@/contexto";
import { ErroDePermissao } from "@/erros";

// Quem usa o Marketing: alguma permissão marketing.* (o mesmo acesso que o
// RLS exige dos cadastros, core.pode_modulo). Vale antes de toda leitura pela
// service role em nome de alguém.

export function usaOModulo(ctx: Contexto): boolean {
  return [...ctx.permissoes].some((p) => p.startsWith("marketing."));
}

/** Lança 403 (o "Sem acesso ao módulo Marketing." do antigo) se não usa. */
export function exigirModulo(ctx: Contexto): void {
  if (!usaOModulo(ctx)) throw new ErroDePermissao();
}

/** A permissão conferida agora no banco, sem lançar (o podeAgora do antigo). */
export async function podeAgora(
  ctx: Contexto,
  permissao: Permissao,
): Promise<boolean> {
  try {
    await exigir(ctx, permissao);
    return true;
  } catch (erro) {
    if (erro instanceof ErroDePermissao) return false;
    throw erro;
  }
}

/** "aaaa-mm-dd" de hoje em Brasília. */
export const hoje = () => hojeEmBrasilia(new Date());
