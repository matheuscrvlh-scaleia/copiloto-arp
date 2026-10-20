import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Cifra os segredos das integrações (senhas e tokens) antes de irem para o
// banco. A chave fica só no servidor (INTEGRACOES_CHAVE, 32 bytes em base64);
// quem tiver só o banco não consegue ler os segredos.
// Formato: v1.<iv>.<tag>.<texto cifrado>, tudo em base64url.

const VERSAO = "v1";

function chave(): Buffer {
  const valor = process.env.INTEGRACOES_CHAVE?.trim();
  if (!valor) {
    throw new Error(
      "Cofre não configurado: defina INTEGRACOES_CHAVE (32 bytes em base64)",
    );
  }
  const bytes = Buffer.from(valor, "base64");
  if (bytes.length !== 32) {
    throw new Error("INTEGRACOES_CHAVE precisa ter 32 bytes em base64");
  }
  return bytes;
}

export function cofreConfigurado(): boolean {
  try {
    chave();
    return true;
  } catch {
    return false;
  }
}

/**
 * `contexto` (ex.: o sistema) entra como dado autenticado: o texto cifrado
 * de uma integração não abre como se fosse de outra.
 */
export function cifrar(texto: string, contexto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave(), iv);
  c.setAAD(Buffer.from(contexto));
  const cifrado = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return [VERSAO, iv, c.getAuthTag(), cifrado]
    .map((p) => (typeof p === "string" ? p : p.toString("base64url")))
    .join(".");
}

export function decifrar(valor: string, contexto: string): string {
  const [versao, iv, tag, cifrado] = valor.split(".");
  if (versao !== VERSAO || !iv || !tag || cifrado === undefined) {
    throw new Error("segredo em formato desconhecido");
  }
  const d = createDecipheriv(
    "aes-256-gcm",
    chave(),
    Buffer.from(iv, "base64url"),
  );
  d.setAAD(Buffer.from(contexto));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    d.update(Buffer.from(cifrado, "base64url")),
    d.final(),
  ]).toString("utf8");
}
