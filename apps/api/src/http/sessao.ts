import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "@/config/env";
import type { Credenciais } from "@/modules/auth/auth.service";

// Os dois cookies da sessão: HttpOnly e SameSite=Strict, sempre.
// - Site em https (produção e homologação): `Secure` e os prefixos
//   `__Host-` (só este host, Path=/) e `__Secure-`.
// - Site em http (desenvolvimento local, SITE_URL=http://localhost:5173): o
//   navegador recusa esses prefixos sem HTTPS, então os nomes saem sem
//   prefixo e sem `Secure`. Quem decide é o SITE_URL (env.COOKIES_SEGUROS).

export const COOKIE_ACESSO = env.COOKIES_SEGUROS
  ? "__Host-arp_acesso"
  : "arp_acesso";
export const COOKIE_RENOVACAO = env.COOKIES_SEGUROS
  ? "__Secure-arp_renovacao"
  : "arp_renovacao";

const BASE = {
  httpOnly: true,
  secure: env.COOKIES_SEGUROS,
  sameSite: "strict",
} as const;
const ACESSO = { ...BASE, path: "/" } as const;
// O token de renovação só viaja para as rotas de acesso.
const RENOVACAO = { ...BASE, path: "/api/v1/auth" } as const;

const segundosAte = (quando: Date) =>
  Math.max(0, Math.floor((quando.getTime() - Date.now()) / 1000));

export function cookiesDaSessao(request: FastifyRequest): {
  acesso: string | undefined;
  renovacao: string | undefined;
} {
  return {
    acesso: request.cookies[COOKIE_ACESSO],
    renovacao: request.cookies[COOKIE_RENOVACAO],
  };
}

export function gravarCookies(reply: FastifyReply, c: Credenciais): void {
  reply.setCookie(COOKIE_ACESSO, c.acesso.jwt, {
    ...ACESSO,
    maxAge: segundosAte(c.acesso.expiraEm),
  });
  if (c.renovacao)
    reply.setCookie(COOKIE_RENOVACAO, c.renovacao.token, {
      ...RENOVACAO,
      maxAge: segundosAte(c.renovacao.expiraEm),
    });
}

export function limparCookies(reply: FastifyReply): void {
  reply.clearCookie(COOKIE_ACESSO, ACESSO);
  reply.clearCookie(COOKIE_RENOVACAO, RENOVACAO);
}
