import { z } from "zod";
import { momento } from "./base";
import { enetCliente, enetContrato, enetLuc } from "./fontes";

// Ocupação e estoque (spec 4.5) e o detalhe do LUC.
//
//   GET /api/v1/comercial/ocupacao              → RespostaOcupacao
//   GET /api/v1/comercial/ocupacao/lucs/:numero → RespostaLuc
//
// Sem comercial.valores.ver o aluguel dos contratos vem 0 (a tela não mostra
// valor sem a permissão). Dos clientes só vai o que as contas usam: código,
// atividade e uma chave do documento (para juntar a transferência de LUC do
// mesmo locatário), nunca o CPF/CNPJ, o nome ou os sócios.

export const respostaOcupacao = momento.extend({
  lucs: z.array(enetLuc),
  contratos: z.array(enetContrato),
  clientes: z.array(enetCliente),
  /** Tipos de LUC que contam na ocupação (parâmetros). */
  contam: z.array(z.string()),
  transferenciaDias: z.number(),
  curva: z.object({ a: z.number(), b: z.number() }),
  exemplo: z.boolean(),
});
export type RespostaOcupacao = z.infer<typeof respostaOcupacao>;

export const paramsLuc = z.object({ numero: z.string().min(1).max(60) });

export const respostaLuc = momento.extend({
  luc: enetLuc,
  /** Contratos do LUC já iniciados, do mais recente para o mais antigo. */
  contratos: z.array(enetContrato),
  exemplo: z.boolean(),
});
export type RespostaLuc = z.infer<typeof respostaLuc>;
