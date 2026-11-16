import { LIMIAR_PARECIDOS, normalizar, similaridade } from "./importacao/comum";

// Campo "lista de cadastro" (spec 4.8): a lista cresce com o uso (ex.:
// produtores da feira). Antes de criar um nome novo, o sistema mostra os
// parecidos já cadastrados para não duplicar. Puro.

/** O nome já está na lista (sem acento/caixa)? Devolve a grafia cadastrada. */
export function nomeCadastrado(
  nome: string,
  lista: readonly string[],
): string | undefined {
  const n = normalizar(nome);
  return n ? lista.find((x) => normalizar(x) === n) : undefined;
}

/**
 * Nomes parecidos da lista (do mais parecido para o menos), para sugerir
 * antes de criar um novo. Vazio se o nome já existe ou é curto demais.
 */
export function nomesParecidos(
  nome: string,
  lista: readonly string[],
  max = 3,
  limiar = LIMIAR_PARECIDOS,
): string[] {
  const n = normalizar(nome);
  if (n.length < 3 || nomeCadastrado(nome, lista)) return [];
  return lista
    .map((x) => ({ x, s: similaridade(n, x) }))
    .filter((c) => c.s >= limiar || normalizar(c.x).includes(n))
    .sort((a, b) => b.s - a.s)
    .slice(0, max)
    .map((c) => c.x);
}

/** Normalizado como em `cadastros_lista.normalizado`. */
export const normalizadoDoCadastro = (nome: string) => normalizar(nome);
