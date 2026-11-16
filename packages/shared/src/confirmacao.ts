/**
 * Separa a confirmação em título e explicação: "Excluir X de vez? Não tem
 * volta." vira o título "Excluir X de vez?" e o texto "Não tem volta.".
 * Sem "?" (ou só no fim), tudo é título.
 */
export function separarPergunta(confirmacao: string): {
  titulo: string;
  texto?: string;
} {
  const fim = confirmacao.indexOf("?");
  if (fim < 0) return { titulo: confirmacao.trim() };
  const texto = confirmacao.slice(fim + 1).trim();
  return {
    titulo: confirmacao.slice(0, fim + 1).trim(),
    texto: texto || undefined,
  };
}
