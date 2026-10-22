// Retorno sobre pessoal: o custo da folha frente à receita e ao custo total
// da ARP. O faturamento é lançado à mão (Cadastros) até a integração com o
// ENET; enquanto falta o do mês da folha, a tela usa um ilustrativo.

export interface Receita {
  valor: number;
  /** true: faturamento ainda não lançado, valor só para ilustrar a conta. */
  ilustrativa: boolean;
}

/**
 * Faturamento bruto dos meses da folha. Com todos lançados, a soma deles.
 * Faltando algum, o ilustrativo: o faturamento que deixaria o custo da ARP
 * exatamente na meta de % sobre a receita (custo ÷ meta). Sem meta, nada.
 */
export function receitaDoPeriodo(
  lancados: (number | null)[],
  custoTotal: number,
  metaPct: number | null,
): Receita | null {
  if (lancados.length && lancados.every((f) => f !== null && f > 0)) {
    return {
      valor: lancados.reduce<number>((s, f) => s + (f ?? 0), 0),
      ilustrativa: false,
    };
  }
  if (!metaPct || metaPct <= 0 || custoTotal <= 0) return null;
  return { valor: custoTotal / (metaPct / 100), ilustrativa: true };
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
  custoDespesa: (number | null)[],
): number | null {
  if (!custoDespesa.length || custoDespesa.some((v) => v === null || v <= 0)) {
    return null;
  }
  const total = custoDespesa.reduce<number>((s, v) => s + (v ?? 0), 0);
  return (custo / total) * 100;
}
