import { z } from "zod";
import { momento } from "./base";

// Pesquisa de mercado (spec 4.16): imóveis pesquisados (só locação).
//
//   GET   /api/v1/comercial/pesquisa                 → RespostaPesquisa
//   GET   /api/v1/comercial/pesquisa/apoio           → RespostaApoioPesquisa
//   GET   /api/v1/comercial/pesquisa/imoveis/:id     → RespostaImovel
//   POST  /api/v1/comercial/pesquisa/imoveis         Formulario → { mensagem, id }
//   PATCH /api/v1/comercial/pesquisa/imoveis/:id     Formulario → { mensagem }

export const imovelPesquisado = z.object({
  id: z.string(),
  data_pesquisa: z.string(),
  cep: z.string().nullable(),
  endereco: z.string(),
  bairro: z.string(),
  tipo: z.string(),
  area_m2: z.number(),
  aluguel: z.number(),
  condominio: z.number().nullable(),
  iptu: z.number().nullable(),
  vagas: z.number().nullable(),
  observacao: z.string().nullable(),
  fonte: z.string().nullable(),
  valor_m2: z.number().nullable(),
  custo_total: z.number().nullable(),
  custo_m2: z.number().nullable(),
  exemplo: z.boolean(),
  criado_em: z.string(),
  importado: z.boolean(),
});
export type ImovelPesquisado = z.infer<typeof imovelPesquisado>;

/** Linha "ARP": valor por m² do Painel no último mês fechado. */
export const valorM2Arp = z.object({
  mes: z.string(),
  faturamento: z.number(),
  ablLocada: z.number(),
  valor: z.number().nullable(),
  exemplo: z.boolean(),
});

export const respostaPesquisa = momento.extend({
  imoveis: z.array(imovelPesquisado),
  faixasM2: z.array(z.number()),
  /** Lista pesquisa_tipo (ativos). */
  tipos: z.array(z.string()),
  arp: valorM2Arp,
});
export type RespostaPesquisa = z.infer<typeof respostaPesquisa>;

export const respostaApoioPesquisa = momento.extend({
  bairros: z.array(z.string()),
  tipos: z.array(z.string()),
  faixasM2: z.array(z.number()),
});
export type RespostaApoioPesquisa = z.infer<typeof respostaApoioPesquisa>;

export const respostaImovel = z.object({ imovel: imovelPesquisado });
export type RespostaImovel = z.infer<typeof respostaImovel>;

export const paramsImovel = z.object({ id: z.uuid() });

export const respostaImovelCriado = z.object({
  mensagem: z.string(),
  id: z.string(),
});
