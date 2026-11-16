import {
  respostaMetas,
  respostaPainel,
} from "@arp/shared/comercial/contratos/painel";
import { queryOptions } from "@tanstack/react-query";
import { acaoDaApi } from "@/lib/acao";
import { api } from "@/lib/api";
import { VALIDADE } from "@/lib/consulta";
import { chavesCom } from "./chaves";

/** GET /api/v1/comercial/painel?ano= (sem ano: o ano de hoje). */
export const consultaDoPainel = (ano: number | null) =>
  queryOptions({
    queryKey: chavesCom.painel(ano),
    queryFn: ({ signal }) =>
      api.get("/comercial/painel", {
        esquema: respostaPainel,
        consulta: { ano },
        sinal: signal,
      }),
  });

/** GET /api/v1/comercial/metas */
export const consultaDasMetas = queryOptions({
  queryKey: chavesCom.metas(),
  queryFn: ({ signal }) =>
    api.get("/comercial/metas", { esquema: respostaMetas, sinal: signal }),
  staleTime: VALIDADE.configuracao,
});

/** PUT /api/v1/comercial/metas (a grade inteira do ano). */
export const salvarMetas = acaoDaApi({
  metodo: "PUT",
  caminho: "/comercial/metas",
  invalida: [chavesCom.tudo],
});
