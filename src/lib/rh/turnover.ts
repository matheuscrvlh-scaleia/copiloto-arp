/** Tipos de turnover configuráveis em cada motivo de desligamento. */
export const TIPOS_TURNOVER = [
  "voluntario",
  "involuntario",
  "termino_contrato",
  "efetivacao",
] as const;

export type TipoTurnover = (typeof TIPOS_TURNOVER)[number];

export const ROTULO_TURNOVER: Record<string, string> = {
  voluntario: "Voluntário (pedido de demissão)",
  involuntario: "Involuntário (pela empresa)",
  termino_contrato: "Término de contrato",
  efetivacao: "Efetivação (não conta no turnover)",
  nao_classificado: "Sem classificação",
};
