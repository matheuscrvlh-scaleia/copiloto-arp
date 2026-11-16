import { mesesAte } from "@arp/shared/operacoes/energisa-contas";

// O mês das telas de Contas de energia e de Energia solar (do
// src/server/operacoes/contas.ts antigo, que eram regras de tela).

/** O mês pedido na URL, se tiver fatura; senão o mais novo. */
export function mesDaTela(meses: string[], url: string | null): string | null {
  if (url && meses.includes(url)) return url;
  return meses[0] ?? null;
}

/** Os 12 meses do gráfico (até o mês da tela). */
export const mesesDoGrafico = (mes: string) => mesesAte(mes, 12);
