// Quanto do plano (ou odonto) de cada dependente fica com a empresa e quanto
// o funcionário paga, pela regra do benefício. Com "Empresa não paga" o
// funcionário paga a mensalidade inteira da faixa do dependente.

export type RegraDependente = "nao_paga" | "percentual" | "valor_fixo";

export interface ParteDoDependente {
  empresa: number;
  /** Null quando a mensalidade não saiu (sem nascimento ou fora das faixas). */
  funcionario: number | null;
}

const arred = (v: number) => Math.round(v * 100) / 100;

export function parteDoDependente(
  regra: RegraDependente,
  /** % (percentual) ou R$ (valor_fixo); ignorado em nao_paga. */
  valorDaRegra: number | null,
  mensalidade: number | null,
): ParteDoDependente {
  let empresa = 0;
  if (regra === "valor_fixo") empresa = valorDaRegra ?? 0;
  else if (regra === "percentual" && mensalidade !== null)
    empresa = (mensalidade * (valorDaRegra ?? 0)) / 100;
  empresa = arred(empresa);
  return {
    empresa,
    funcionario:
      mensalidade === null ? null : arred(Math.max(mensalidade - empresa, 0)),
  };
}
