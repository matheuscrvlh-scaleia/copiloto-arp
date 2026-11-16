import {
  respostaBlocoEventos,
  respostaBlocoFunil,
  respostaBlocoOcupacao,
  respostaCalendario,
  respostaHistorico,
  respostaParametros,
} from "@arp/shared/comercial/contratos/configuracoes";
import type { GrupoHistorico } from "@arp/shared/comercial/parametros/index";
import { queryOptions } from "@tanstack/react-query";
import type { Acao } from "@/components/form-acao";
import { acaoDaApi } from "@/lib/acao";
import { api } from "@/lib/api";
import { VALIDADE } from "@/lib/consulta";
import { chavesCom } from "./chaves";

// Comercial › Configurações › Parâmetros e Histórico. As ações têm os nomes
// das Server Actions de antes (acoes/parametros). Toda gravação invalida o
// Comercial inteiro: parâmetros e listas aparecem em várias telas.

const BASE = "/comercial/configuracoes";
const invalida = [chavesCom.tudo];
const doForm = (form: FormData, campo: string) =>
  encodeURIComponent(String(form.get(campo) ?? ""));

/** GET /api/v1/comercial/configuracoes/parametros */
export const consultaParametros = queryOptions({
  queryKey: chavesCom.parametros(),
  queryFn: ({ signal }) =>
    api.get(`${BASE}/parametros`, {
      esquema: respostaParametros,
      sinal: signal,
    }),
  staleTime: VALIDADE.configuracao,
});

/** GET /api/v1/comercial/configuracoes/parametros/funil */
export const consultaBlocoFunil = queryOptions({
  queryKey: chavesCom.blocoParametros("funil"),
  queryFn: ({ signal }) =>
    api.get(`${BASE}/parametros/funil`, {
      esquema: respostaBlocoFunil,
      sinal: signal,
    }),
  staleTime: VALIDADE.configuracao,
});

/** GET /api/v1/comercial/configuracoes/parametros/ocupacao */
export const consultaBlocoOcupacao = queryOptions({
  queryKey: chavesCom.blocoParametros("ocupacao"),
  queryFn: ({ signal }) =>
    api.get(`${BASE}/parametros/ocupacao`, {
      esquema: respostaBlocoOcupacao,
      sinal: signal,
    }),
  staleTime: VALIDADE.configuracao,
});

/** GET /api/v1/comercial/configuracoes/parametros/eventos */
export const consultaBlocoEventos = queryOptions({
  queryKey: chavesCom.blocoParametros("eventos"),
  queryFn: ({ signal }) =>
    api.get(`${BASE}/parametros/eventos`, {
      esquema: respostaBlocoEventos,
      sinal: signal,
    }),
  staleTime: VALIDADE.configuracao,
});

/** GET /api/v1/comercial/configuracoes/parametros/calendario */
export const consultaCalendario = queryOptions({
  queryKey: chavesCom.blocoParametros("calendario"),
  queryFn: ({ signal }) =>
    api.get(`${BASE}/parametros/calendario`, {
      esquema: respostaCalendario,
      sinal: signal,
    }),
  staleTime: VALIDADE.configuracao,
});

/** GET /api/v1/comercial/configuracoes/historico?grupo=&limite= */
export const consultaHistorico = (
  grupo: GrupoHistorico | undefined,
  limite: number,
) =>
  queryOptions({
    queryKey: chavesCom.historico(grupo ?? "", limite),
    queryFn: ({ signal }) =>
      api.get(`${BASE}/historico`, {
        esquema: respostaHistorico,
        consulta: { grupo, limite },
        sinal: signal,
      }),
  });

/** PUT /api/v1/comercial/configuracoes/parametros (um bloco). */
export const salvarParametros: Acao = acaoDaApi({
  metodo: "PUT",
  caminho: `${BASE}/parametros`,
  invalida,
});

/** PUT /api/v1/comercial/configuracoes/listas/:lista */
export const salvarLista: Acao = acaoDaApi({
  metodo: "PUT",
  caminho: (form) => `${BASE}/listas/${doForm(form, "lista")}`,
  invalida,
});

/** PUT /api/v1/comercial/configuracoes/de-para (todas as linhas). */
export const salvarDePara: Acao = acaoDaApi({
  metodo: "PUT",
  caminho: `${BASE}/de-para`,
  invalida,
});

/** POST /api/v1/comercial/configuracoes/de-para */
export const incluirFonteDePara: Acao = acaoDaApi({
  metodo: "POST",
  caminho: `${BASE}/de-para`,
  invalida,
});

/** DELETE /api/v1/comercial/configuracoes/de-para?fonte_rd= */
export const removerFonteDePara: Acao = acaoDaApi({
  metodo: "DELETE",
  caminho: (form) => `${BASE}/de-para?fonte_rd=${doForm(form, "fonte_rd")}`,
  invalida,
});

/** PUT /api/v1/comercial/configuracoes/tipos-luc */
export const salvarTiposLuc: Acao = acaoDaApi({
  metodo: "PUT",
  caminho: `${BASE}/tipos-luc`,
  invalida,
});

/** POST /api/v1/comercial/configuracoes/tipos-luc */
export const incluirTipoLuc: Acao = acaoDaApi({
  metodo: "POST",
  caminho: `${BASE}/tipos-luc`,
  invalida,
});

/** PUT /api/v1/comercial/configuracoes/faixas-evento (inclui ou altera). */
export const salvarFaixaEvento: Acao = acaoDaApi({
  metodo: "PUT",
  caminho: `${BASE}/faixas-evento`,
  invalida,
});

/** DELETE /api/v1/comercial/configuracoes/faixas-evento/:id */
export const removerFaixaEvento: Acao = acaoDaApi({
  metodo: "DELETE",
  caminho: (form) => `${BASE}/faixas-evento/${doForm(form, "id")}`,
  invalida,
});

/** POST /api/v1/comercial/configuracoes/feriados */
export const incluirFeriado: Acao = acaoDaApi({
  metodo: "POST",
  caminho: `${BASE}/feriados`,
  invalida,
});

/** DELETE /api/v1/comercial/configuracoes/feriados/:data */
export const removerFeriado: Acao = acaoDaApi({
  metodo: "DELETE",
  caminho: (form) => `${BASE}/feriados/${doForm(form, "data")}`,
  invalida,
});
