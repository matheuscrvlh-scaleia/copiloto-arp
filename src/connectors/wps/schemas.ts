import { z } from "zod";

// Formato conferido com a API de homologação (demonstracao.parkingplus.com.br) em 19/10/2026.

const terminal = z.object({
  codigo: z.number(),
  descricao: z.string(),
  tipo: z.string(),
});

const formaPagamento = z.object({
  codigo: z.number(),
  codigoMapeado: z.number(),
  descricao: z.string(),
  codigoBandeiraTef: z.string().optional(),
  descricaoPagamentoBase: z.string(),
});

const rps = z.object({
  id_interno: z.number(),
  numero: z.number(),
  serie: z.string().optional(),
  data_emissao: z.string(),
});

export const pagamentoSchema = z.object({
  /** Identificador do pagamento. Repete quando há mais de uma RPS. */
  codigo: z.number(),
  /** Tipo de cliente/convênio, ex.: ROTATIVO. */
  descricao: z.string(),
  /** "aaaa-mm-dd hh:mm:ss", horário local. */
  data: z.string(),
  ticket: z.string(),
  placa: z.string().optional(),
  recibo: z.string(),
  valorBruto: z.number(),
  valorLiquido: z.number(),
  desconto: z.number().optional(),
  operador: z.string(),
  parcial: z.number(),
  nsu: z.string().optional(),
  docTef: z.string().optional(),
  autorizacaotef: z.string().optional(),
  terminal,
  formaPagamento,
  tarifa: z.string(),
  externo: z
    .object({ codigo: z.number(), data: z.string(), ticket: z.string() })
    .optional(),
  rps: rps.optional(),
});

const grupoPagamento = z.object({
  quantidade: z.number(),
  descricao: z.string(),
  detalhes: z.array(pagamentoSchema).optional(),
});

/** GET .../{yyyymmdd}/pagamento?detalhe=true */
export const pagamentosDoDiaSchema = z.object({
  quantidade: z.number(),
  subdetalhes: z.record(z.string(), grupoPagamento),
});

/** GET .../{yyyymmdd}/entrada e .../saida */
export const movimentoDoDiaSchema = z.object({
  quantidade: z.number(),
  subdetalhes: z.record(
    z.string(),
    z.object({ quantidade: z.number(), descricao: z.string() }),
  ),
});

export type Pagamento = z.infer<typeof pagamentoSchema>;
export type PagamentosDoDia = z.infer<typeof pagamentosDoDiaSchema>;
export type MovimentoDoDia = z.infer<typeof movimentoDoDiaSchema>;
