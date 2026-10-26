import "server-only";

// O PostgREST devolve no máximo `max_rows` linhas por consulta (1000, em
// supabase/config.toml) e corta o resto sem avisar: nem erro, nem contagem.
// Toda leitura que pode passar disso (todos os colaboradores, as jornadas,
// os vínculos de benefício, as linhas de uma folha…) lê página a página.

/** Linhas por página: o `max_rows` do projeto. */
export const LINHAS_POR_PAGINA = 1000;

interface Resposta<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/** Uma consulta do supabase-js ainda sem `.range` (select ou rpc). */
interface Paginavel<T> {
  range(de: number, ate: number): PromiseLike<Resposta<T>>;
}

/**
 * Todas as linhas de uma consulta, de página em página.
 *
 * `consulta` monta a consulta do zero a cada página (o builder do
 * supabase-js não pode ser reaproveitado) e tem de trazer uma ordem estável
 * que termine numa chave única, ex.: `.order("nome").order("id")`. Sem
 * isso, o banco pode devolver a mesma linha em duas páginas e pular outra.
 *
 * As páginas vão em sequência e param na primeira que vier incompleta.
 * Erro do banco vira exceção (com a mensagem do PostgREST).
 */
export async function lerTudo<T>(
  consulta: () => Paginavel<T>,
  porPagina: number = LINHAS_POR_PAGINA,
): Promise<T[]> {
  if (!Number.isInteger(porPagina) || porPagina < 1)
    throw new RangeError(`página inválida: ${porPagina}`);
  const linhas: T[] = [];
  for (let de = 0; ; de += porPagina) {
    const { data, error } = await consulta().range(de, de + porPagina - 1);
    if (error)
      throw new Error(`Falha ao ler o banco: ${error.message}`, {
        cause: error,
      });
    const pagina = data ?? [];
    for (const linha of pagina) linhas.push(linha);
    if (pagina.length < porPagina) return linhas;
  }
}
