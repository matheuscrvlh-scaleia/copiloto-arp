import type { FastifyInstance } from "fastify";
import type { Contexto } from "@/contexto";
import type { RotaRegistrada } from "@/http/permissao";
import { COOKIE_ACESSO } from "@/http/sessao";
import { assinarAcesso } from "@/modules/auth/tokens";

// A IA lê o sistema pelas mesmas rotas das telas, como a pessoa que
// perguntou: um pedido interno (`inject`, sem sair do processo) com um
// acesso novo da mesma sessão. Passa por tudo o que o pedido da tela passa:
// permissão da rota, validação, RLS (`comoUsuario` nos services) e corte da
// resposta pelo schema. Se a sessão acabar no meio, a leitura falha como na
// tela. Só GET: a IA nunca grava.

let servidor: FastifyInstance | null = null;

/** O plugin da IA chama ao subir (o `inject` é do servidor inteiro). */
export function ligarServidor(app: FastifyInstance): void {
  servidor = app;
}

/** As rotas do servidor, para montar o catálogo de fontes. */
export function rotasRegistradas(): readonly RotaRegistrada[] {
  return servidor?.rotas ?? [];
}

export interface Leitura {
  status: number;
  tipo: string;
  corpo: string;
}

export async function lerComo(ctx: Contexto, url: string): Promise<Leitura> {
  if (!servidor) throw new Error("IA: servidor não ligado");
  const { jwt } = await assinarAcesso(ctx.usuario.id, ctx.sessao.id);
  const r = await servidor.inject({
    method: "GET",
    url,
    cookies: { [COOKIE_ACESSO]: jwt },
    headers: {
      accept: "application/json",
      // O pedido nasce no próprio processo (127.0.0.1, proxy confiável): o
      // IP de quem perguntou segue para o limite de requisições e o log.
      "x-forwarded-for": ctx.ip,
      "user-agent": "IA ARP",
    },
  });
  return {
    status: r.statusCode,
    tipo: String(r.headers["content-type"] ?? ""),
    corpo: r.body,
  };
}
