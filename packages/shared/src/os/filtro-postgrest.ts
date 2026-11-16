// Pedaços de filtro do PostgREST montados a partir do que a pessoa digita
// (busca do topo das listas). O texto vai dentro de um `.or(...)`, onde
// vírgula, parênteses, aspas e dois-pontos são sintaxe: viram espaço. `*` e
// `%` são curingas do `ilike`: também saem, para a busca ser só texto.

/** Texto da busca pronto para o filtro; null quando não sobra nada. */
export function termoDeBusca(texto: string | null | undefined): string | null {
  const limpo = (texto ?? "")
    .replace(/[,()"\\:*%]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return limpo || null;
}

/**
 * Filtro do `.or()` que procura o texto (sem diferenciar maiúsculas) nas
 * colunas e, quando é um número inteiro, também o número exato.
 * Ex.: `titulo.ilike.*bomba*,descricao.ilike.*bomba*`.
 */
export function buscaNoOr(
  texto: string | null | undefined,
  colunas: string[],
  colunaNumero?: string,
): string | null {
  const t = termoDeBusca(texto);
  if (!t) return null;
  const partes = colunas.map((c) => `${c}.ilike.*${t}*`);
  const n = t.replace(/^#/, "");
  if (colunaNumero && /^\d{1,9}$/.test(n))
    partes.push(`${colunaNumero}.eq.${n}`);
  return partes.join(",");
}

/**
 * Lista de valores para `coluna.in.(…)` dentro de um `.or()` (uuids e
 * códigos simples). Valores com sintaxe do PostgREST são descartados.
 */
export function listaNoOr(coluna: string, valores: string[]): string | null {
  const ok = valores.filter((v) => /^[\w-]+$/.test(v));
  return ok.length ? `${coluna}.in.(${ok.join(",")})` : null;
}

/** Início do mês de `data` (aaaa-mm-dd) e do mês seguinte, em Brasília. */
export function limitesDoMes(data: string): { de: string; ate: string } {
  const [a, m] = data.split("-").map(Number) as [number, number];
  const prox =
    m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
  return {
    de: `${data.slice(0, 7)}-01T00:00:00-03:00`,
    ate: `${prox}-01T00:00:00-03:00`,
  };
}

/**
 * Página além do fim (link antigo, filtro que encolheu): o PostgREST
 * responde 416 (PGRST103) sem o total, que vem só no texto do erro. Devolve
 * o total nesse caso; null para qualquer outro erro.
 */
export function totalForaDoIntervalo(erro: {
  code?: string;
  details?: string | null;
}): number | null {
  if (erro.code !== "PGRST103") return null;
  const n = /only (\d+) rows?/.exec(erro.details ?? "")?.[1];
  return n === undefined ? 0 : Number(n);
}

/**
 * O que os filtros das listas usam de uma consulta do PostgREST: a da
 * página e a das contagens têm colunas diferentes, os filtros são os
 * mesmos (uma função só aplica nas duas).
 */
export interface Filtravel<Q> {
  eq(coluna: string, valor: unknown): Q;
  neq(coluna: string, valor: unknown): Q;
  in(coluna: string, valores: readonly unknown[]): Q;
  is(coluna: string, valor: null): Q;
  not(coluna: string, operador: string, valor: unknown): Q;
  gte(coluna: string, valor: unknown): Q;
  lte(coluna: string, valor: unknown): Q;
  lt(coluna: string, valor: unknown): Q;
  or(filtros: string, opcoes?: { referencedTable?: string }): Q;
}
