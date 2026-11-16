import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// Peças da autorização OAuth que não dependem de banco nem de Next: o state
// (contra CSRF: só a volta que começou neste navegador vale) e o PKCE.

/** Texto aleatório em base64url (state e verificador do PKCE). */
export function aleatorio(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Compara o state da volta com o do cookie em tempo constante. */
export function mesmoState(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
}

/** Desafio S256 do PKCE: base64url do SHA-256 do verificador. */
export function desafioPkce(verificador: string): string {
  return createHash("sha256").update(verificador).digest("base64url");
}
