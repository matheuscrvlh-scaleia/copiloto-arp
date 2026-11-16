import { createHash, createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { tokenValido } from "@arp/shared/os/portal";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "@/config/env";

// Cookie da sessão do portal do lojista. É outra sessão, sem relação com a
// dos usuários do sistema:
// - nome, caminho e formato próprios: só viaja para as rotas do portal
//   público (`Path`), e o plugin de permissão nunca o lê;
// - valor `<token>.<assinatura>`: o token é aleatório e a assinatura é um
//   HMAC-SHA256 com uma chave derivada de JWT_CHAVE por HKDF com rótulo
//   próprio. Um JWT de usuário não passa aqui (formato e chave diferentes)
//   e este valor não passa como JWT (não é um, e a chave é outra);
// - no banco (os.portal_sessoes.token) fica só o SHA-256 do token: quem lê
//   a tabela não consegue montar o cookie;
// - o cookie só diz qual é a sessão. O servidor confere no banco, a cada
//   acesso, se ela não foi encerrada, se está no prazo e se o contrato da
//   loja continua vigente.
// `SameSite=Lax`: o lojista chega por um link do WhatsApp.

export const CAMINHO_DO_PORTAL = "/api/v1/os/portal-publico";

export const COOKIE_DO_PORTAL = env.COOKIES_SEGUROS
  ? "__Secure-arp_portal"
  : "arp_portal";

const OPCOES = {
  httpOnly: true,
  secure: env.COOKIES_SEGUROS,
  sameSite: "lax",
  path: CAMINHO_DO_PORTAL,
} as const;

let chave: Buffer | undefined;

function chaveDoPortal(): Buffer {
  chave ??= Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(env.JWT_CHAVE, "base64"),
      Buffer.alloc(0),
      "arp/portal-do-lojista/sessao/v1",
      32,
    ),
  );
  return chave;
}

const assinar = (token: string) =>
  createHmac("sha256", chaveDoPortal()).update(token).digest("base64url");

/** Valor do cookie para o token da sessão. */
export function valorDoCookie(token: string): string {
  return `${token}.${assinar(token)}`;
}

/** Token do cookie; null se faltar, estiver malformado ou adulterado. */
export function tokenDoCookie(valor: string | undefined): string | null {
  if (!valor || valor.length > 300) return null;
  const partes = valor.split(".");
  if (partes.length !== 2) return null;
  const [token = "", assinatura = ""] = partes;
  if (!tokenValido(token)) return null;
  const esperada = Buffer.from(assinar(token));
  const recebida = Buffer.from(assinatura);
  if (esperada.length !== recebida.length) return null;
  return timingSafeEqual(esperada, recebida) ? token : null;
}

/** O que fica em os.portal_sessoes.token: o SHA-256 do token. */
export function hashDoToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

export function tokenDoPedido(request: FastifyRequest): string | null {
  return tokenDoCookie(request.cookies[COOKIE_DO_PORTAL]);
}

export function gravarCookieDoPortal(
  reply: FastifyReply,
  token: string,
  expira: Date,
): void {
  reply.setCookie(COOKIE_DO_PORTAL, valorDoCookie(token), {
    ...OPCOES,
    expires: expira,
  });
}

export function limparCookieDoPortal(reply: FastifyReply): void {
  reply.clearCookie(COOKIE_DO_PORTAL, OPCOES);
}
