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

interface Periodo {
  desde: string;
  ate: string | null;
}

/** Vale no mês (aaaa-mm-01): começou até o fim dele e não acabou antes dele. */
export function valeNoMes(p: Periodo, mes: string): boolean {
  return (
    p.desde.slice(0, 7) <= mes.slice(0, 7) && (p.ate === null || p.ate >= mes)
  );
}

/**
 * O titular recebe o benefício no mês pelo vínculo dele ou pelo tipo de
 * contrato (como no custo). Sem isso, o dependente fica sem plano no
 * Centralizador mesmo marcado no Copiloto.
 */
export function titularRecebe(
  titular: { colaborador_id: string; tipo_contrato: string | null },
  vinculos: (Periodo & { colaborador_id: string })[],
  contratos: (Periodo & { tipo_contrato: string })[],
  mes: string,
): boolean {
  return (
    vinculos.some(
      (v) => v.colaborador_id === titular.colaborador_id && valeNoMes(v, mes),
    ) ||
    contratos.some(
      (c) => c.tipo_contrato === titular.tipo_contrato && valeNoMes(c, mes),
    )
  );
}
