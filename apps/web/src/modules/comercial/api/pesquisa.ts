import {
  respostaApoioPesquisa,
  respostaImovel,
  respostaPesquisa,
} from "@arp/shared/comercial/contratos/pesquisa";
import { queryOptions } from "@tanstack/react-query";
import type { Acao } from "@/components/form-acao";
import { acaoDaApi } from "@/lib/acao";
import { api } from "@/lib/api";
import { VALIDADE } from "@/lib/consulta";
import { chavesCom } from "./chaves";

// Comercial › Pesquisa de mercado. A ação tem o nome da Server Action de
// antes (acoes/pesquisa: salvarImovel).

const BASE = "/comercial/pesquisa";

/** GET /api/v1/comercial/pesquisa */
export const consultaPesquisa = queryOptions({
  queryKey: chavesCom.telaPesquisa(),
  queryFn: ({ signal }) =>
    api.get(BASE, { esquema: respostaPesquisa, sinal: signal }),
});

/** GET /api/v1/comercial/pesquisa/apoio (bairros e tipos dos parâmetros) */
export const consultaApoioPesquisa = queryOptions({
  queryKey: chavesCom.apoioPesquisa(),
  queryFn: ({ signal }) =>
    api.get(`${BASE}/apoio`, { esquema: respostaApoioPesquisa, sinal: signal }),
  staleTime: VALIDADE.configuracao,
});

/** GET /api/v1/comercial/pesquisa/imoveis/:id */
export const consultaImovel = (id: string) =>
  queryOptions({
    queryKey: chavesCom.imovel(id),
    queryFn: ({ signal }) =>
      api.get(`${BASE}/imoveis/${encodeURIComponent(id)}`, {
        esquema: respostaImovel,
        sinal: signal,
      }),
  });

/**
 * POST /api/v1/comercial/pesquisa/imoveis (sem id) ou PATCH
 * /api/v1/comercial/pesquisa/imoveis/:id (correção). Antes, o cadastro
 * voltava para a lista: quem usa passa a navegação em `depois`.
 */
export const salvarImovel = (depois: () => void): Acao => {
  const novo = acaoDaApi({
    metodo: "POST",
    caminho: `${BASE}/imoveis`,
    invalida: [chavesCom.pesquisa],
    aoGravar: depois,
  });
  return (anterior, form) => {
    const id = String(form.get("id") ?? "");
    if (!id) return novo(anterior, form);
    return acaoDaApi({
      metodo: "PATCH",
      caminho: `${BASE}/imoveis/${encodeURIComponent(id)}`,
      invalida: [chavesCom.pesquisa],
    })(anterior, form);
  };
};
