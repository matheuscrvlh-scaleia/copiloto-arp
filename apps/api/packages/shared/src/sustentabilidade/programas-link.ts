import { paraBrasilia } from "../os/tempo";

// Link do parceiro (spec 4.8): o token só existe no endereço que a equipe
// envia; o banco guarda o sha256 em hexa (`programa_links.token_hash`).
// Gerar o token e calcular o hash usam o `node:crypto` e ficam na API
// (modules/sustentabilidade/parceiro-token.ts).

/** Formato do token (32 bytes em base64url); o resto nem chega ao banco. */
export function tokenValido(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
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
