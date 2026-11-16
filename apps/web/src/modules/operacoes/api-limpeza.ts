import {
  respostaMesDoRateio,
  respostaMesesDoRateio,
} from "@arp/shared/operacoes/contratos/limpeza";
import { queryOptions } from "@tanstack/react-query";
import { api, BASE_DA_API } from "@/lib/api";

// Leituras do rateio da limpeza (/api/v1/operacoes/limpeza). As gravações
// ficam em ./acoes-limpeza.ts.

export const chavesLimpeza = {
  tudo: ["operacoes", "limpeza"] as const,
  meses: () => ["operacoes", "limpeza", "meses"] as const,
  mes: (ref: string) => ["operacoes", "limpeza", "meses", ref] as const,
};

/** GET /operacoes/limpeza/meses */
export const consultaDosMesesDoRateio = queryOptions({
  queryKey: chavesLimpeza.meses(),
  queryFn: ({ signal }) =>
    api.get("/operacoes/limpeza/meses", {
      esquema: respostaMesesDoRateio,
      sinal: signal,
    }),
});

/** GET /operacoes/limpeza/meses/:mes (aaaa-mm) */
export const consultaDoMesDoRateio = (ref: string) =>
  queryOptions({
    queryKey: chavesLimpeza.mes(ref),
    queryFn: ({ signal }) =>
      api.get(`/operacoes/limpeza/meses/${ref.slice(0, 7)}`, {
        esquema: respostaMesDoRateio,
        sinal: signal,
      }),
  });

/** Demonstrativo em PDF (abre na API, com a sessão). */
export const hrefDoDemonstrativo = (ref: string) =>
  `${BASE_DA_API}/operacoes/limpeza/meses/${ref.slice(0, 7)}/demonstrativo`;

/** Resultado em Excel (abre na API, com a sessão). */
export const hrefDaPlanilhaDoRateio = (ref: string) =>
  `${BASE_DA_API}/operacoes/limpeza/meses/${ref.slice(0, 7)}/planilha`;
