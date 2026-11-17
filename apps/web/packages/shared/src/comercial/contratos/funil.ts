import { z } from "zod";
import { ESTADOS } from "../fontes";
import type { OportunidadeFunil } from "../funil";
import { momento } from "./base";

// Funil comercial (spec 4.4).
//
//   GET /api/v1/comercial/funil → RespostaFunil
//
// Sem comercial.funil.ver_contato os contatos vêm null; sem
// comercial.valores.ver, os valores. A tela filtra e conta com as regras de
// ../funil.

const nulo = z.string().nullable();

export const oportunidadeFunil = z.object({
  id: z.string(),
  criacao: z.string(),
  ano: z.number(),
  mes: z.number(),
  nome: z.string(),
  empresa: nulo,
  qualificacao: z.number(),
  funil: z.string(),
  etapa: z.string(),
  estado: z.enum(ESTADOS),
  motivoPerda: nulo,
  anotacaoPerda: nulo,
  valorUnico: z.number().nullable(),
  valorRecorrente: z.number().nullable(),
  pausada: z.boolean(),
  primeiraInteracao: nulo,
  ultimaInteracao: nulo,
  diasSemInteracao: z.number().nullable(),
  proximaTarefa: z.object({ data: z.string(), assunto: z.string() }).nullable(),
  previsaoFechamento: nulo,
  dataFechamento: nulo,
  fonte: z.string(),
  fonteAjustada: z.string(),
  campanha: z.string(),
  responsavel: z.string(),
  imovel: z.string(),
  perfil: z.string(),
  tamanho: z.string(),
  segmento: z.string(),
  landingPage: nulo,
  contatos: z
    .array(
      z.object({
        nome: z.string(),
        cargo: nulo,
        email: nulo,
        telefone: nulo,
      }),
    )
    .nullable(),
}) satisfies z.ZodType<OportunidadeFunil>;

export const respostaFunil = momento.extend({
  oportunidades: z.array(oportunidadeFunil),
  /** Nomes das fontes ajustadas do de-para (parâmetros), em ordem. */
  fontesAjustadas: z.array(z.string()),
  landingPages: z.array(
    z.object({ conversion_identifier: z.string(), nome: z.string() }),
  ),
  funilPadrao: z.string(),
  /** Por que o RD Station CRM não entregou; null quando leu. */
  aviso: z.string().nullable(),
  podeContato: z.boolean(),
  podeValores: z.boolean(),
});
export type RespostaFunil = z.infer<typeof respostaFunil>;
