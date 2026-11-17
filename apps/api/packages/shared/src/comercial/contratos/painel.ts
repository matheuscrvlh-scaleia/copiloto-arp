import { z } from "zod";
import {
  INDICADORES_PAINEL,
  type IndicadorPainel,
  type LinhaPainel,
} from "../painel";
import { momento } from "./base";

// Painel de indicadores e as metas (Comercial › Configurações › Metas).
//
//   GET  /api/v1/comercial/painel?ano=2026   → RespostaPainel
//   GET  /api/v1/comercial/metas             → { metas: MetaCom[] } + momento
//   PUT  /api/v1/comercial/metas             { ano, "<indicador>.<mês>": "1.234,56" } → { mensagem }

const indicadores = Object.keys(INDICADORES_PAINEL) as [
  IndicadorPainel,
  ...IndicadorPainel[],
];
const origem = z.enum(["foto", "hoje", "calculado", "sem_historico"]);
const numeros = z.array(z.number().nullable());

export const linhaPainel = z.object({
  indicador: z.enum(indicadores),
  plan: numeros,
  real: numeros,
  atingido: numeros,
  marcas: z.array(origem.nullable()),
  acumulado: z.object({
    plan: z.number().nullable(),
    real: z.number().nullable(),
    atingido: z.number().nullable(),
  }),
}) satisfies z.ZodType<LinhaPainel>;

export const consultaPainel = z.object({
  ano: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const respostaPainel = momento.extend({
  ano: z.number(),
  linhas: z.array(linhaPainel),
  exemplo: z.boolean(),
  /** Por que o RD Station CRM não entregou (leads vazios); null quando leu. */
  avisoRd: z.string().nullable(),
  /** false: sem comercial.valores.ver, só as linhas que não são em reais. */
  comValores: z.boolean(),
  /** Algum mês sem foto de ocupação (calculado ou sem histórico). */
  semFoto: z.boolean(),
  /** Contratos do sistema com carência (o número é parcial). */
  contratosComCarencia: z.number(),
  /** Anos com dado no ENET ou no RD, e o próximo (para ver as metas). */
  anos: z.array(z.number()),
});
export type RespostaPainel = z.infer<typeof respostaPainel>;

export const respostaMetas = momento.extend({
  metas: z.array(
    z.object({
      indicador: z.string(),
      vigente_desde: z.string(),
      meta: z.number(),
    }),
  ),
});
export type RespostaMetas = z.infer<typeof respostaMetas>;

/** O formulário da grade: `ano` e um campo "<indicador>.<mês>" por célula. */
export const entradaMetas = z
  .object({
    ano: z.coerce
      .number({ error: "Ano inválido." })
      .int("Ano inválido.")
      .min(2000, "Ano inválido.")
      .max(2100, "Ano inválido."),
  })
  .catchall(z.string().max(40));
export type EntradaMetas = z.infer<typeof entradaMetas>;
