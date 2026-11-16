import { createHash, randomBytes } from "node:crypto";
import { paraBrasilia } from "@/lib/os/tempo";

// Link do parceiro (spec 4.8): o token só existe no endereço que a equipe
// envia; o banco guarda o sha256 em hexa (`programa_links.token_hash`). A
// página /parceiro/[token] calcula o hash e procura o link ativo.

/** 32 bytes aleatórios em base64url (43 caracteres). */
export function novoToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Formato do token gerado aqui; o resto nem chega ao banco. */
export function tokenValido(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

/** sha256 do token em hexa minúsculo (o que fica no banco). */
export function hashDoToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** O hash guardado é o deste token? */
export function confereToken(token: string, hash: string): boolean {
  return tokenValido(token) && hashDoToken(token) === hash.toLowerCase();
}

/** "aaaa-mm" de um instante, no horário de Brasília. */
export function mesDeBrasilia(instante: Date | string): string {
  return paraBrasilia(new Date(instante)).data.slice(0, 7);
}

/**
 * O parceiro corrige pelo link o que lançou no mês corrente, até o fim do
 * mês (Brasília): o lançamento é do mês em que foi enviado, não da data do
 * fato (uma feira do dia 30 lançada no dia 2 se corrige até o fim do dia 2).
 */
export function podeCorrigirPeloLink(
  criadoEm: Date | string,
  agora: Date,
): boolean {
  return mesDeBrasilia(criadoEm) === mesDeBrasilia(agora);
}

/** Primeiro instante do mês corrente em Brasília (UTC−3), em ISO. */
export function inicioDoMesEmBrasilia(agora: Date): string {
  const mes = mesDeBrasilia(agora);
  return new Date(`${mes}-01T03:00:00.000Z`).toISOString();
}
