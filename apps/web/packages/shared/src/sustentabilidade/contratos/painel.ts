import { z } from "zod";
import type { LinhaConsolidada, PainelMontado } from "../painel-montagem";

// Contratos do Painel de Sustentabilidade (spec 4.9) e do relatório do mês.

/** GET /sustentabilidade/painel?ano=&ate=&comparar= (os filtros da URL, como vieram). */
export const consultaDoPainel = z.object({
  ano: z.string().max(10).optional(),
  ate: z.string().max(10).optional(),
  comparar: z.string().max(10).optional(),
});
export type ConsultaDoPainel = z.infer<typeof consultaDoPainel>;

const objeto = <T>() => z.custom<T>((v) => typeof v === "object" && v !== null);

export const respostaPainel = z.object({
  /** "aaaa-mm-dd" de hoje em Brasília. */
  hoje: z.string(),
  /** "Dados de dd/mm/aaaa às hh:mm". */
  dadosDe: z.string(),
  filtros: z.object({
    ano: z.number(),
    ateMes: z.number(),
    comparar: z.boolean(),
  }),
  /** Anos que o filtro oferece. */
  anos: z.array(z.number()),
  /** Cartões, gráficos, equivalências e comparação, já montados. */
  painel: objeto<PainelMontado>(),
  consolidados: objeto<LinhaConsolidada[]>(),
  /** Colunas da tabela de consolidados (reais só com "Ver valores"). */
  comValores: z.boolean(),
  /** Situação do ano do filtro. */
  anoDoFiltro: z.enum(["aberto", "fechado", "reaberto"]),
  /** Diferenças do ano fechado (lançamento alterado depois de fechar). */
  avisoDoAno: objeto<NonNullable<LinhaConsolidada["aviso"]>>().nullable(),
  /** Fontes com dado de exemplo dentro do período mostrado. */
  exemplo: z.array(z.string()),
  /** Operações não respondeu: energia e água ficam "sem dado". */
  operacoesIndisponivel: z.boolean(),
});
export type RespostaPainel = z.infer<typeof respostaPainel>;

/** POST /sustentabilidade/relatorio/:mes ("aaaa-mm") */
export const mesDoRelatorio = z.object({ mes: z.string().max(20) });
