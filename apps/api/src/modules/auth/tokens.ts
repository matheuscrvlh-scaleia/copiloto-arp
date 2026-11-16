import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { ACESSO_MS } from "@arp/shared/sessao";
import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import { env } from "@/config/env";

// Os dois tokens da sessão.
// - Acesso: JWT curto (HS256, JWT_CHAVE) com `sub` (usuário) e `sid`
//   (sessão). Só prova quem é; o que a pessoa pode é lido do banco a cada
//   requisição.
// - Renovação: `<sid>.<segredo aleatório>`. O banco guarda só o SHA-256 do
//   segredo; quem ler o banco não consegue montar o cookie.

const chave = Buffer.from(env.JWT_CHAVE, "base64");
const EMISSOR = "arp";
const ALGORITMO = "HS256";

const conteudo = z.object({
  sub: z.uuid(),
  sid: z.uuid(),
  exp: z.number().int(),
});

export interface Acesso {
  usuarioId: string;
  sessaoId: string;
  expiraEm: Date;
}

export async function assinarAcesso(
  usuarioId: string,
  sessaoId: string,
  agora = Date.now(),
): Promise<{ jwt: string; expiraEm: Date }> {
  const expiraEm = new Date(agora + ACESSO_MS);
  const jwt = await new SignJWT({ sid: sessaoId })
    .setProtectedHeader({ alg: ALGORITMO })
    .setIssuer(EMISSOR)
    .setSubject(usuarioId)
    .setIssuedAt(Math.floor(agora / 1000))
    .setExpirationTime(Math.floor(expiraEm.getTime() / 1000))
    .sign(chave);
  return { jwt, expiraEm };
}

/** O conteúdo do JWT, ou null se a assinatura não bate ou o prazo passou. */
export async function lerAcesso(
  jwt: string | undefined,
): Promise<Acesso | null> {
  if (!jwt || jwt.length > 2048) return null;
  try {
    const { payload } = await jwtVerify(jwt, chave, {
      algorithms: [ALGORITMO],
      issuer: EMISSOR,
    });
    const c = conteudo.parse(payload);
    return {
      usuarioId: c.sub,
      sessaoId: c.sid,
      expiraEm: new Date(c.exp * 1000),
    };
  } catch {
    return null;
  }
}

const hashDe = (segredo: string) =>
  createHash("sha256").update(segredo).digest("hex");

export function novoTokenDeRenovacao(sessaoId: string): {
  token: string;
  hash: string;
} {
  const segredo = randomBytes(32).toString("base64url");
  return { token: `${sessaoId}.${segredo}`, hash: hashDe(segredo) };
}

const formato = z.tuple([z.uuid(), z.string().regex(/^[A-Za-z0-9_-]{43}$/)]);

/** A sessão e o hash do segredo que o cookie traz; null se malformado. */
export function lerTokenDeRenovacao(
  token: string | undefined,
): { sessaoId: string; hash: string } | null {
  const partes = formato.safeParse(token?.split("."));
  if (!partes.success) return null;
  const [sessaoId, segredo] = partes.data;
  return { sessaoId, hash: hashDe(segredo) };
}

/** Compara dois hashes em tempo constante. */
export function mesmoHash(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
