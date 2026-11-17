// Retorno sobre pessoal: o custo da folha frente à receita e ao custo total
// da ARP. Faturamento e custo + despesa são lançados à mão (Cadastros) até a
// integração com o ENET; enquanto falta o do mês da folha, a tela usa um
// ilustrativo.

export interface ValorDoMes {
  valor: number;
  /** true: ainda não lançado para o mês, valor só para ilustrar a conta. */
  ilustrativa: boolean;
  /** De onde saiu o ilustrativo. */
  base?: "outro_mes" | "meta";
}

export type Receita = ValorDoMes;

/**
 * Valor lançado dos meses da folha (a soma deles). Faltando algum, o
 * ilustrativo: o último lançado (de outro mês) repetido em cada mês.
 */
export function lancadoOuExemplo(
  lancados: (number | null)[],
  ultimoLancado: number | null,
): ValorDoMes | null {
  if (lancados.length && lancados.every((v) => v !== null && v > 0)) {
    return {
      valor: lancados.reduce<number>((s, v) => s + (v ?? 0), 0),
      ilustrativa: false,
    };
  }
  if (ultimoLancado && ultimoLancado > 0) {
    return {
      valor: ultimoLancado * Math.max(lancados.length, 1),
      ilustrativa: true,
      base: "outro_mes",
    };
  }
  return null;
}

/**
 * Faturamento bruto dos meses da folha: o lançado ou o de outro mês. Sem
 * nenhum faturamento lançado, o que deixaria o custo da ARP exatamente na
 * meta de % sobre a receita (custo ÷ meta). Sem os dois, nada.
 */
export function receitaDoPeriodo(
  lancados: (number | null)[],
  custoTotal: number,
  metaPct: number | null,
  ultimoLancado: number | null = null,
): Receita | null {
  const lancado = lancadoOuExemplo(lancados, ultimoLancado);
  if (lancado) return lancado;
  if (!metaPct || metaPct <= 0 || custoTotal <= 0) return null;
  return {
    valor: custoTotal / (metaPct / 100),
    ilustrativa: true,
    base: "meta",
  };
}

/** Parte do faturamento que vai para o custo, em %. */
export function sobreReceita(custo: number, receita: number): number | null {
  return receita > 0 ? (custo / receita) * 100 : null;
}

/** Faturamento ÷ colaboradores ativos (com vários meses, por pessoa e mês). */
export function receitaPorColaborador(
  receita: number,
  ativos: number,
): number | null {
  return ativos > 0 ? receita / ativos : null;
}

/** Quantos reais de receita cada R$ 1 de folha gera. */
export function indiceDeRetorno(
  receitaPorPessoa: number | null,
  custoMedio: number | null,
): number | null {
  return receitaPorPessoa !== null && custoMedio
    ? receitaPorPessoa / custoMedio
    : null;
}

/** Custo de pessoal ÷ custo + despesa total do mês, em %. */
export function participacaoDaFolha(
  custo: number,
  custoDespesa: number,
): number | null {
  return custoDespesa > 0 ? (custo / custoDespesa) * 100 : null;
}
