// Paginação das listas do módulo Tickets: a página vem na URL (?pagina=2),
// o servidor busca só as linhas dela (.range) e conta o total junto
// (count: "exact"). Funções puras, para as telas e o teste.

/** Linhas por página nas listas grandes. */
export const POR_PAGINA = 30;

/** Página da URL (1 em diante); qualquer coisa inválida vira 1. */
export function paginaDaUrl(valor: string | string[] | undefined): number {
  const v = Array.isArray(valor) ? valor[0] : valor;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** Intervalo do PostgREST (.range(de, ate), inclusivo) de uma página. */
export function intervalo(
  pagina: number,
  porPagina = POR_PAGINA,
): { de: number; ate: number } {
  const de = (Math.max(1, pagina) - 1) * porPagina;
  return { de, ate: de + porPagina - 1 };
}

export function totalDePaginas(total: number, porPagina = POR_PAGINA): number {
  return Math.max(1, Math.ceil(total / porPagina));
}

/**
 * Páginas para os botões: a primeira, a última e as vizinhas da atual, com
 * "…" (null) nos buracos. Ex.: 1 … 4 5 6 … 20.
 */
export function paginasVisiveis(
  atual: number,
  total: number,
  vizinhas = 1,
): (number | null)[] {
  const paginas: (number | null)[] = [];
  for (let p = 1; p <= total; p++) {
    const perto = Math.abs(p - atual) <= vizinhas;
    if (p === 1 || p === total || perto) paginas.push(p);
    else if (paginas.at(-1) !== null) paginas.push(null);
  }
  return paginas;
}

/** "31–60 de 412". */
export function descreverIntervalo(
  pagina: number,
  total: number,
  porPagina = POR_PAGINA,
): string {
  if (total === 0) return "0 de 0";
  const { de } = intervalo(pagina, porPagina);
  const fim = Math.min(de + porPagina, total);
  return `${de + 1}–${fim} de ${total}`;
}
