import { createHash, randomBytes } from "node:crypto";
import { tokenValido } from "@arp/shared/sustentabilidade/programas-link";

// Token do link do parceiro (spec 4.8): só existe no endereço que a equipe
// envia; o banco guarda o sha256 em hexa (`programa_links.token_hash`).
// Fica na API porque usa o `node:crypto` (packages/shared não importa Node).

/** 32 bytes aleatórios em base64url (43 caracteres). */
export function novoToken(): string {
  return randomBytes(32).toString("base64url");
}

/** sha256 do token em hexa minúsculo (o que fica no banco). */
export function hashDoToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** O hash guardado é o deste token? */
export function confereToken(token: string, hash: string): boolean {
  return tokenValido(token) && hashDoToken(token) === hash.toLowerCase();
}
