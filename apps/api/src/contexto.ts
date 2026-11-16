import type { Permissao } from "@arp/shared/permissions";
import { sql } from "kysely";
import { ErroDePermissao } from "./erros";
import { banco } from "./infra/banco";

// Quem fez o pedido. O plugin de permissão monta a partir da sessão e o
// controller repassa ao service; o service nunca recebe request/reply.

/** O que se sabe de qualquer pedido, mesmo sem sessão (rota pública). */
export interface Origem {
  ip: string;
  /** Navegador (User-Agent), já cortado. */
  agente: string | null;
  /** Id da requisição, o mesmo do log. */
  requisicaoId: string;
}

export interface Contexto extends Origem {
  usuario: { id: string; nome: string; email: string };
  /** Lidas do banco nesta requisição (mesma regra de core.minhas_permissoes). */
  permissoes: ReadonlySet<Permissao>;
  senhaProvisoria: boolean;
  sessao: {
    id: string;
    inicio: Date;
    ultimoUso: Date;
    acessoExpiraEm: Date;
  };
}

/** Permissão lida no começo desta requisição. Para decidir o que mostrar. */
export function pode(ctx: Contexto, permissao: Permissao): boolean {
  return ctx.permissoes.has(permissao);
}

/**
 * Confere a permissão AGORA no banco (core.pode) e lança ErroDePermissao.
 * Obrigatório antes de `banco.comoServico` em nome de alguém: a service role
 * ignora o RLS, então esta é a única trava.
 */
export async function exigir(
  ctx: Contexto,
  permissao: Permissao,
): Promise<void> {
  const ok = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const r = await sql<{
      pode: boolean;
    }>`select core.pode(${permissao}) as pode`.execute(tx);
    return r.rows[0]?.pode === true;
  });
  if (!ok) throw new ErroDePermissao();
}
