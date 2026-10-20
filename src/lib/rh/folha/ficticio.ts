import type {
  ColaboradorExtrato,
  ExtratoMensal,
  RubricaExtrato,
} from "./extrato";

/** Salário usado no protótipo no lugar do real (especificação do RH, 16/10). */
export const SALARIO_FICTICIO = 2000;

const arred = (v: number) => Math.round(v * 100) / 100;

/**
 * Rubrica que pode ficar com o valor real no protótipo: desconto de benefício
 * com valor fixo (plano, odonto, alimentação), que não revela o salário e é
 * usado para inferir a faixa do plano. Desconto percentual (ex.: "VALE
 * TRANSPORTE - 1%") revela o salário e é reescalado.
 */
export function mantemValorReal(
  rubrica: RubricaExtrato,
  grupo: string | undefined,
): boolean {
  if (grupo === "reembolso_inss" || grupo === "arredondamento") return true;
  return grupo === "beneficio_desconto" && !rubrica.descricao.includes("%");
}

/**
 * Protótipo: troca o salário de cada pessoa por R$ 2.000,00 e reescala, na
 * mesma proporção, tudo o que deriva do salário (rubricas, bases, FGTS), para
 * nenhum valor gravado revelar o salário real. Proventos, descontos e líquido
 * são recalculados das rubricas, então a folha continua fechando. O resumo da
 * empresa (totais reais) é descartado.
 */
export function aplicarSalarioFicticio(
  extrato: ExtratoMensal,
  grupoDaRubrica: (codigo: number) => string | undefined,
  valor = SALARIO_FICTICIO,
): ExtratoMensal {
  const colaboradores = extrato.colaboradores.map((c): ColaboradorExtrato => {
    const fator = c.salario && c.salario > 0 ? valor / c.salario : 0;
    const escala = (v: number | null) => (v === null ? null : arred(v * fator));
    const rubricas = c.rubricas.map((r) => ({
      ...r,
      valor: mantemValorReal(r, grupoDaRubrica(r.codigo))
        ? r.valor
        : arred(r.valor * fator),
    }));
    const total = (n: RubricaExtrato["natureza"]) =>
      arred(
        rubricas
          .filter((r) => r.natureza === n)
          .reduce((s, r) => s + r.valor, 0),
      );
    const proventos = total("provento");
    const descontos = total("desconto");
    return {
      ...c,
      salario: valor,
      rubricas,
      proventos,
      descontos,
      liquido: arred(proventos - descontos),
      base_inss: escala(c.base_inss),
      base_fgts: escala(c.base_fgts),
      valor_fgts: escala(c.valor_fgts),
    };
  });
  return { ...extrato, colaboradores, resumo: {}, liquido_geral: null };
}
