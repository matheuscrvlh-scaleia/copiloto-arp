import { z } from "zod";

// Contratos comuns do módulo Comercial (/api/v1/comercial/*): o "hoje" e o
// "Dados de…" de cada tela e a configuração igual para todos do módulo
// (parâmetros, listas, de-para de fontes, tipos de LUC, faixas de evento e
// metas). Cada recurso tem o seu arquivo nesta pasta.

/** Hoje em Brasília e "Dados de dd/mm/aaaa às hh:mm" da leitura. */
export const momento = z.object({ hoje: z.string(), dadosDe: z.string() });
export type Momento = z.infer<typeof momento>;

export const respostaMensagem = z.object({ mensagem: z.string() });
export type RespostaMensagem = z.infer<typeof respostaMensagem>;

/** comercial.parametros (linha única). */
export const parametros = z.object({
  id: z.boolean(),
  atualizado_em: z.string(),
  capitalizacao_prazo_dias: z.number(),
  caucao_alugueis: z.number(),
  caucao_prazo_dias: z.number(),
  censo_dias_mensalidade: z.number(),
  consumo_agua_padrao: z.boolean(),
  curva_a_pct: z.number(),
  curva_b_pct: z.number(),
  dia_vencimento_padrao: z.number(),
  empreendimento_nome: z.string(),
  endereco_bairro: z.string(),
  endereco_cep: z.string(),
  endereco_cidade: z.string(),
  endereco_complemento: z.string().nullable(),
  endereco_logradouro: z.string(),
  endereco_numero: z.string(),
  endereco_uf: z.string(),
  entrega_padrao: z.string(),
  entrega_prazo_implantacao_dias: z.number(),
  entrega_tipo_imovel: z.string(),
  evento_area_texto: z.string(),
  evento_condicao_pagamento: z.string(),
  evento_desconto_pct: z.number(),
  evento_desmontagem: z.string(),
  evento_fechamento_dias_uteis: z.number(),
  evento_horario: z.string(),
  evento_m2_por_agente: z.number(),
  evento_montagem: z.string(),
  evento_notas: z.array(z.string()),
  evento_pessoas_por_seguranca: z.number(),
  evento_reajuste_pct: z.number(),
  evento_validade_dias: z.number(),
  ficha_boas_vindas: z.string(),
  ficha_termo_lgpd: z.string(),
  ficha_validade_dias: z.number(),
  formulario_texto_convite: z.string(),
  funil_midia: z.string(),
  funil_padrao: z.string(),
  indice_padrao: z.string(),
  kit_aviso_dias: z.number(),
  lembrete_aniversario_dias: z.number(),
  locadora_cnpj: z.string(),
  locadora_razao_social: z.string(),
  locadora_representacao: z.string(),
  multa_alugueis: z.number(),
  nc004_versao: z.string(),
  obras_projetos_dias: z.number(),
  obras_retirada_dias: z.number(),
  obras_tapume_dias: z.number(),
  obrigatorios_garantia: z.unknown(),
  pesquisa_faixas_m2: z.array(z.number()),
  reajuste_previsto_dias: z.number(),
  relacionamento_asana_projeto: z.string(),
  relacionamento_canal_visita: z.string(),
  transferencia_dias: z.number(),
  vaga_promocional_padrao: z.number(),
  vencimento_faixa1_dias: z.number(),
  vencimento_faixa2_dias: z.number(),
});
export type Parametros = z.infer<typeof parametros>;

/** comercial.listas. */
export const lista = z.object({
  id: z.string(),
  lista: z.string(),
  valor: z.string(),
  ordem: z.number(),
  ativo: z.boolean(),
  extra: z.unknown(),
  atualizado_em: z.string(),
});
export type Lista = z.infer<typeof lista>;

export const fonteDePara = z.object({
  fonte_rd: z.string(),
  fonte_ajustada: z.string(),
  atualizado_em: z.string(),
});
export type FonteDePara = z.infer<typeof fonteDePara>;

export const tipoLuc = z.object({
  tipo: z.string(),
  conta_ocupacao: z.boolean(),
  ordem: z.number(),
  receita: z.string().nullable(),
  atualizado_em: z.string(),
});
export type TipoLuc = z.infer<typeof tipoLuc>;

export const faixaEvento = z.object({
  id: z.string(),
  nome: z.string(),
  ordem: z.number(),
  area_de: z.number(),
  area_ate: z.number(),
  valor_comum: z.number(),
  valor_sazonal: z.number(),
  fixo: z.boolean(),
  atualizado_em: z.string(),
});
export type FaixaEvento = z.infer<typeof faixaEvento>;

/** Meta do Painel (core.metas, indicador "comercial.*", uma linha por mês). */
export const metaCom = z.object({
  id: z.string(),
  indicador: z.string(),
  direcao: z.enum(["maior_melhor", "menor_melhor"]),
  meta: z.number(),
  limite_atencao: z.number().nullable(),
  /** "aaaa-mm-01". */
  vigente_desde: z.string(),
});
export type MetaCom = z.infer<typeof metaCom>;

/** Listas de comercial.listas (o check da coluna "lista"). */
export type NomeListaCom =
  | "fonte_ajustada"
  | "tipo_contato"
  | "canal_contato"
  | "censo_bloco"
  | "censo_segmento"
  | "censo_expectativa"
  | "pesquisa_bairro"
  | "pesquisa_tipo"
  | "ficha_documento_pf"
  | "ficha_documento_pj"
  | "ficha_documento_fiador"
  | "evento_observacao"
  | "kit_categoria";
