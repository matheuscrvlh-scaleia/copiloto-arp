import { z } from "zod";
import { momento } from "./base";
import { enetContrato } from "./fontes";

// Vencimentos de contrato (spec 4.6) e o detalhe de um contrato.
//
//   GET /api/v1/comercial/vencimentos            → RespostaVencimentos
//   GET /api/v1/comercial/vencimentos/:contrato  → RespostaVencimento
//
// Sem comercial.valores.ver o aluguel vem 0 (a tela passa comValores=false
// às regras de ../vencimentos, que tiram o valor). Índices null: o Banco
// Central não respondeu e a tela segue sem a estimativa.

const porIndice = <T extends z.ZodType>(t: T) => z.object({ IGPM: t, IPCA: t });

export const dadosDosVencimentos = momento.extend({
  contratos: z.array(enetContrato),
  lucs: z.array(
    z.object({ numero: z.string(), local: z.string(), abl: z.number() }),
  ),
  faixas: z.object({ faixa1: z.number(), faixa2: z.number() }),
  diasReajuste: z.number(),
  acumulados: porIndice(z.number().nullable()),
  ate: porIndice(z.string().nullable()),
  exemplo: z.boolean(),
});

export const respostaVencimentos = dadosDosVencimentos;
export type RespostaVencimentos = z.infer<typeof respostaVencimentos>;

export const paramsVencimento = z.object({
  contrato: z.string().min(1).max(60),
});

export const respostaVencimento = dadosDosVencimentos.extend({
  /** Ramo de atividade do locatário (ENET — Clientes). */
  atividade: z.string(),
});
export type RespostaVencimento = z.infer<typeof respostaVencimento>;
