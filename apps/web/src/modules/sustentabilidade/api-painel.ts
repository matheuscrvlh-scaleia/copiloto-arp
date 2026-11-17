import { respostaPainel } from "@arp/shared/sustentabilidade/contratos/painel";
import { queryOptions } from "@tanstack/react-query";
import { acaoDaApi } from "@/lib/acao";
import { api } from "@/lib/api";
import { chavesSustentabilidade } from "./api";

// Painel de Sustentabilidade na tela (/api/v1/sustentabilidade): a leitura,
// o fechar/reabrir do ano e o relatório do mês em PDF.

/** GET /sustentabilidade/painel?ano=&ate=&comparar= (os filtros como estão na URL) */
export const consultaDoPainel = (filtros: {
  ano: string;
  ate: string;
  comparar: string;
}) =>
  queryOptions({
    queryKey: chavesSustentabilidade.painel(filtros),
    queryFn: ({ signal }) =>
      api.get("/sustentabilidade/painel", {
        esquema: respostaPainel,
        consulta: filtros,
        sinal: signal,
      }),
  });

/** POST /sustentabilidade/painel/anos/fechar */
export const fecharAno = acaoDaApi({
  metodo: "POST",
  caminho: "/sustentabilidade/painel/anos/fechar",
  invalida: [chavesSustentabilidade.painel()],
});

/** POST /sustentabilidade/painel/anos/reabrir */
export const reabrirAno = acaoDaApi({
  metodo: "POST",
  caminho: "/sustentabilidade/painel/anos/reabrir",
  invalida: [chavesSustentabilidade.painel()],
});

/**
 * POST /sustentabilidade/relatorio/:mes ("aaaa-mm"): o PDF do relatório do
 * mês. É POST porque gerar conclui o chamado recorrente do relatório.
 */
export function gerarRelatorioDoMes(mes: string): Promise<Blob> {
  return api
    .baixar(`/sustentabilidade/relatorio/${mes}`, { metodo: "POST" })
    .then((r) => r.blob);
}
