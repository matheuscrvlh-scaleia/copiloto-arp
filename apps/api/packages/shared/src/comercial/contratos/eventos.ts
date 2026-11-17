import { z } from "zod";
import type { StatusProposta } from "../eventos";
import { momento } from "./base";

// Simulador e propostas de evento (spec 4.15).
//
//   GET   /api/v1/comercial/eventos                       → RespostaEventos
//   GET   /api/v1/comercial/eventos/apoio                 → RespostaApoioEventos
//   GET   /api/v1/comercial/eventos/feriados?anos=a,b     → RespostaFeriadosEventos
//   GET   /api/v1/comercial/eventos/propostas/:id         → RespostaProposta
//   GET   /api/v1/comercial/eventos/propostas/:id/pdf     → PDF
//   POST  /api/v1/comercial/eventos/propostas             Formulario → { mensagem, id }
//   PATCH /api/v1/comercial/eventos/propostas/:id         Formulario → { mensagem }
//   PATCH /api/v1/comercial/eventos/propostas/:id/status  { status } → { mensagem }

export const faixaPreco = z.object({
  ordem: z.number(),
  nome: z.string(),
  area_de: z.number(),
  area_ate: z.number(),
  fixo: z.boolean(),
  valor_comum: z.number(),
  valor_sazonal: z.number(),
});

export const regrasEvento = z.object({
  pessoasPorSeguranca: z.number(),
  m2PorAgente: z.number(),
});

export const propostaNaLista = z.object({
  id: z.string(),
  criado_em: z.string(),
  cliente: z.string(),
  data_evento: z.string().nullable(),
  data_evento_fim: z.string().nullable(),
  area_m2: z.number(),
  valor_final: z.number(),
  status: z.string(),
  validade: z.string().nullable(),
  oportunidade_rd: z.string().nullable(),
  exemplo: z.boolean(),
});
export type PropostaNaLista = z.infer<typeof propostaNaLista>;

export const respostaEventos = momento.extend({
  faixas: z.array(faixaPreco),
  regras: regrasEvento,
  descontoPct: z.number(),
  reajustePct: z.number(),
  propostas: z.array(propostaNaLista),
});
export type RespostaEventos = z.infer<typeof respostaEventos>;

/** Tabela, regras, observações padrão e os textos dos parâmetros. */
export const respostaApoioEventos = momento.extend({
  faixas: z.array(faixaPreco),
  regras: regrasEvento,
  observacoes: z.array(z.string()),
  notas: z.array(z.string()),
  fechamentoDiasUteis: z.number(),
  horario: z.string(),
  descontoPct: z.number(),
  validadeDias: z.number(),
  condicaoPagamento: z.string(),
  montagem: z.string(),
  desmontagem: z.string(),
  areaTexto: z.string(),
});
export type RespostaApoioEventos = z.infer<typeof respostaApoioEventos>;

export const consultaFeriadosEventos = z.object({
  anos: z
    .string()
    .max(60)
    .regex(/^\d{4}(,\d{4})*$/),
});

/** Nacionais (BrasilAPI) + Nova Friburgo; semNacionais se a API caiu. */
export const respostaFeriadosEventos = z.object({
  feriados: z.array(z.string()),
  semNacionais: z.boolean(),
});
export type RespostaFeriadosEventos = z.infer<typeof respostaFeriadosEventos>;

export const propostaEvento = propostaNaLista.extend({
  atualizado_em: z.string(),
  horario: z.string().nullable(),
  tipo_data: z.string(),
  dias: z.number(),
  pessoas: z.number().nullable(),
  desconto_pct: z.number(),
  desconto_primeira_edicao: z.number(),
  valor_original: z.number(),
  valor_parceria: z.number(),
  segurancas: z.number().nullable(),
  agentes_limpeza: z.number().nullable(),
  condicao_pagamento: z.string().nullable(),
  montagem: z.string().nullable(),
  desmontagem: z.string().nullable(),
  fechamento_ate: z.string().nullable(),
  area_evento: z.string().nullable(),
  notas: z.array(z.string()),
  observacoes: z.array(z.string()),
});
export type PropostaEvento = z.infer<typeof propostaEvento>;

export const respostaProposta = z.object({ proposta: propostaEvento });
export type RespostaProposta = z.infer<typeof respostaProposta>;

export const paramsProposta = z.object({ id: z.uuid() });

export const respostaPropostaCriada = z.object({
  mensagem: z.string(),
  id: z.string(),
});

const STATUS = [
  "rascunho",
  "enviada",
  "fechada",
  "perdida",
] as const satisfies readonly StatusProposta[];

export const entradaStatusProposta = z.object({
  status: z.enum(STATUS, "Status inválido."),
});
