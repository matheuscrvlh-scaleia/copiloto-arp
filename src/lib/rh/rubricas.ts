/** Como cada grupo de rubrica entra no custo (especificação do RH, seção 4.2). */
export const GRUPOS_RUBRICA = {
  salario: "Salário",
  pro_labore: "Pró-labore",
  adicional: "Adicionais",
  hora_extra: "Horas extras",
  adiantamento: "Adiantamento (não entra)",
  afastamento: "Afastamento (não entra)",
  rescisao: "Rescisão (custo)",
  pagamento_provisionado: "Férias e 13º pagos (consomem a provisão)",
  beneficio_desconto: "Desconto de benefício (reduz o custo)",
  desconto_terceiros: "Descontos de terceiros (não entra)",
  imposto_funcionario: "Impostos do funcionário (não entra)",
  arredondamento: "Arredondamentos (não entra)",
  reembolso_inss: "Reembolso do INSS (abate do custo)",
  informativa: "Informativa (não entra)",
  nao_classificada: "Não classificada",
} as const;

export type GrupoRubrica = keyof typeof GRUPOS_RUBRICA;

/** Grupos que a Gestora pode escolher ao classificar. */
export const GRUPOS_CLASSIFICAVEIS = (
  Object.keys(GRUPOS_RUBRICA) as GrupoRubrica[]
).filter((g) => g !== "nao_classificada") as [
  Exclude<GrupoRubrica, "nao_classificada">,
  ...Exclude<GrupoRubrica, "nao_classificada">[],
];

export const ROTULO_CONTRATO: Record<string, string> = {
  clt: "CLT",
  aprendiz: "Jovem aprendiz",
  estagiario: "Estagiário",
  pj: "PJ",
  pro_labore: "Pró-labore",
};

export const ROTULO_SITUACAO: Record<string, string> = {
  trabalhando: "Trabalhando",
  ferias: "Férias",
  doenca: "Doença",
  acidente: "Acidente",
  aposentadoria: "Aposentadoria por invalidez",
  demitido: "Demitido",
};
