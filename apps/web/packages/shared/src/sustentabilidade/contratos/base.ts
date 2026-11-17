import { z } from "zod";

// Contratos da base do Sustentabilidade: o contexto da pessoa no módulo, os
// parâmetros (linha única) e os coletores.

const uuid = z.string();
const instante = z.string();

/** GET /sustentabilidade/contexto */
export const respostaContextoSu = z.object({
  /** "Programa – lançar": códigos `sustentabilidade.programa.<id>` da pessoa. */
  programas: z.array(z.string()),
  /** "aaaa-mm-dd" de hoje em Brasília. */
  hoje: z.string(),
  /** "Dados de dd/mm/aaaa às hh:mm". */
  dadosDe: z.string(),
});
export type RespostaContextoSu = z.infer<typeof respostaContextoSu>;

/** sustentabilidade.parametros (linha única), como o banco devolve. */
export const parametrosSu = z.object({
  id: z.boolean(),
  meses_primeira_entrevista: z.number(),
  validade_padrao_meses: z.number(),
  aviso_dias: z.number(),
  tipos_loja_dispensados: z.array(z.string()),
  data_inauguracao: z.string(),
  motivos_dispensa: z.array(z.string()),
  clube_formas: z.array(z.string()),
  termo_validade_meses: z.number(),
  termo_aviso_dias: z.number(),
  formas_contribuicao: z.array(z.string()),
  tipos_acao: z.array(z.string()),
  limite_ocupacao_pct: z.number(),
  recolhimento_setor_id: uuid.nullable(),
  rcc_empresas: z.array(z.string()),
  areas_impacto: z.array(z.string()),
  grupos_impacto: z.array(z.string()),
  cobranca_dia: z.number(),
  unidades: z.array(z.string()),
  atualizado_em: instante,
  atualizado_por: uuid.nullable(),
});
export type ParametrosSu = z.infer<typeof parametrosSu>;

/** GET /sustentabilidade/parametros */
export const respostaParametrosSu = z.object({ parametros: parametrosSu });

/** sustentabilidade.coletores, como o banco devolve. */
export const coletor = z.object({
  id: uuid,
  local: z.string(),
  cor: z.string(),
  conteineres: z.number(),
  /** null = a confirmar. */
  capacidade_l: z.number().nullable(),
  ativo: z.boolean(),
  ordem: z.number(),
  exemplo: z.boolean(),
  criado_em: instante,
  atualizado_em: instante,
});
export type Coletor = z.infer<typeof coletor>;

/** GET /sustentabilidade/coletores */
export const respostaColetores = z.object({ coletores: z.array(coletor) });
