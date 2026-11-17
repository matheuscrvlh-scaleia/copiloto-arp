import { z } from "zod";
import { definicaoSchema } from "../formulario/tipos";
import { formularioParaLancar, listasDeCadastro } from "./lancamentos";

// Contratos da página do parceiro (/parceiro/:token, sem login). Ele vê só
// os formulários publicados do programa e o que ESTE link lançou no mês;
// nada de indicadores, painel, outros programas, clientes ou custos
// calculados pela ARP.

const respostas = z.record(z.string().max(100), z.unknown());

/** Token do link no endereço (o formato é conferido no service). */
export const tokenDoParceiro = z.object({ token: z.string().max(100) });
export const tokenEIdDoParceiro = z.object({
  token: z.string().max(100),
  id: z.uuid(),
});

export const lancamentoDoParceiro = z.object({
  id: z.string(),
  formularioId: z.string(),
  formulario: z.string(),
  data: z.string(),
  resumo: z.string(),
  valores: z.record(z.string(), z.unknown()),
  versao: z.number(),
  criadoEm: z.string(),
  podeCorrigir: z.boolean(),
});
export type LancamentoDoParceiro = z.infer<typeof lancamentoDoParceiro>;

/** GET /sustentabilidade/parceiro/:token */
export const respostaParceiro = z.union([
  z.object({ ativo: z.literal(false) }),
  z.object({
    ativo: z.literal(true),
    programa: z.string(),
    /** Mês corrente (Brasília), "aaaa-mm-01". */
    mes: z.string(),
    formularios: z.array(formularioParaLancar),
    /** Definições das versões dos lançamentos do mês (para corrigir). */
    versoes: z.record(z.string(), definicaoSchema),
    lancamentos: z.array(lancamentoDoParceiro),
    listas: listasDeCadastro,
  }),
]);
export type RespostaParceiro = z.infer<typeof respostaParceiro>;

/** POST /sustentabilidade/parceiro/:token/lancamentos */
export const entradaDoParceiro = z.object({
  formularioId: z.uuid(),
  versao: z.number().int().positive(),
  respostas,
  data: z.string().max(10).nullish(),
});
export type EntradaDoParceiro = z.infer<typeof entradaDoParceiro>;

/** PATCH /sustentabilidade/parceiro/:token/lancamentos/:id */
export const correcaoDoParceiro = z.object({
  respostas,
  data: z.string().max(10).nullish(),
});
export type CorrecaoDoParceiro = z.infer<typeof correcaoDoParceiro>;
