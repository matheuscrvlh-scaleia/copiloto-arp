import {
  respostaApoioEventos,
  respostaEventos,
  respostaFeriadosEventos,
  respostaProposta,
} from "@arp/shared/comercial/contratos/eventos";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import type { Acao } from "@/components/form-acao";
import { acaoDaApi, formParaObjeto } from "@/lib/acao";
import { api, BASE_DA_API } from "@/lib/api";
import { VALIDADE } from "@/lib/consulta";
import { chavesCom } from "./chaves";

// Comercial › Eventos (propostas). As ações têm os nomes das Server Actions
// de antes (acoes/eventos: salvarProposta, mudarStatusProposta).

const BASE = "/comercial/eventos";

/** GET /api/v1/comercial/eventos */
export const consultaEventos = queryOptions({
  queryKey: chavesCom.telaEventos(),
  queryFn: ({ signal }) =>
    api.get(BASE, { esquema: respostaEventos, sinal: signal }),
});

/** GET /api/v1/comercial/eventos/apoio (tabela, regras e textos padrão) */
export const consultaApoioEventos = queryOptions({
  queryKey: chavesCom.apoioEventos(),
  queryFn: ({ signal }) =>
    api.get(`${BASE}/apoio`, { esquema: respostaApoioEventos, sinal: signal }),
  staleTime: VALIDADE.configuracao,
});

/**
 * GET /api/v1/comercial/eventos/feriados?anos= (nacionais + Nova Friburgo).
 * Feriado não muda no dia: fica na memória o tempo da configuração.
 */
export const consultaFeriadosEventos = (anos: number[]) =>
  queryOptions({
    queryKey: chavesCom.feriadosEventos(anos.join(",")),
    queryFn: ({ signal }) =>
      api.get(`${BASE}/feriados`, {
        esquema: respostaFeriadosEventos,
        consulta: { anos: anos.join(",") },
        sinal: signal,
      }),
    staleTime: VALIDADE.configuracao,
  });

/** GET /api/v1/comercial/eventos/propostas/:id */
export const consultaProposta = (id: string) =>
  queryOptions({
    queryKey: chavesCom.proposta(id),
    queryFn: ({ signal }) =>
      api.get(`${BASE}/propostas/${encodeURIComponent(id)}`, {
        esquema: respostaProposta,
        sinal: signal,
      }),
  });

/** "Gerar PDF" (a rota de antes era /comercial/eventos/proposta/:id/pdf). */
export const linkDoPdfDaProposta = (id: string) =>
  `${BASE_DA_API}${BASE}/propostas/${encodeURIComponent(id)}/pdf`;

const criada = z.object({ id: z.string() });
const invalida = [chavesCom.eventos];
const corpo = (form: FormData) =>
  formParaObjeto(form, { listas: ["observacoes"] });

/**
 * POST /api/v1/comercial/eventos/propostas (sem id) ou PATCH
 * /api/v1/comercial/eventos/propostas/:id. A proposta nova abria a página
 * dela: quem usa passa a navegação em `abrir`.
 */
export const salvarProposta = (abrir: (id: string) => void): Acao => {
  const nova = acaoDaApi({
    metodo: "POST",
    caminho: `${BASE}/propostas`,
    corpo,
    invalida,
    aoGravar: (r) => {
      const lida = criada.safeParse(r);
      if (lida.success) abrir(lida.data.id);
    },
  });
  return (anterior, form) => {
    const id = String(form.get("id") ?? "");
    if (!id) return nova(anterior, form);
    return acaoDaApi({
      metodo: "PATCH",
      caminho: `${BASE}/propostas/${encodeURIComponent(id)}`,
      corpo,
      invalida,
    })(anterior, form);
  };
};

/** PATCH /api/v1/comercial/eventos/propostas/:id/status (id e status no formulário). */
export const mudarStatusProposta: Acao = acaoDaApi({
  metodo: "PATCH",
  caminho: (form) =>
    `${BASE}/propostas/${encodeURIComponent(String(form.get("id") ?? ""))}/status`,
  corpo: (form) => ({ status: String(form.get("status") ?? "") }),
  invalida,
});
