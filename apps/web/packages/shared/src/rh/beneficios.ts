// Rótulos dos benefícios (antes em src/server/rh/beneficios.ts): usados pelo
// perfil do funcionário e pelos cadastros.

export const TIPOS_BENEFICIO = {
  plano_saude: "Plano de saúde",
  odonto: "Odonto",
  alimentacao: "Alimentação (VR/VA)",
  transporte: "Vale-transporte",
  seguro: "Seguro de vida",
  outro: "Outro (massagem, auxílio…)",
} as const;
export type TipoBeneficio = keyof typeof TIPOS_BENEFICIO;

export const REGRAS_DEPENDENTE = {
  nao_paga: "Empresa não paga",
  percentual: "Empresa paga um % da faixa",
  valor_fixo: "Empresa paga um valor fixo",
} as const;

export const FORMAS_CALCULO = {
  por_funcionario: "Por funcionário",
  rateado: "Rateado entre funcionários",
} as const;
export type FormaCalculo = keyof typeof FORMAS_CALCULO;

/** Quem entra na divisão do benefício rateado (mesmos códigos do custo). */
export { DIVISOES_RATEIO } from "./custo";

const ROTULOS_DO_TIPO: Record<string, string> = TIPOS_BENEFICIO;

/** Rótulo do tipo gravado no banco (o próprio código se não houver). */
export function rotuloDoTipo(tipo: string): string {
  return ROTULOS_DO_TIPO[tipo] ?? tipo;
}
