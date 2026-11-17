import {
  respostaAniversarios,
  respostaConfigRelacionamento,
  respostaContato,
  respostaContatos,
  respostaLocatarios,
} from "@arp/shared/comercial/contratos/relacionamento";
import { queryOptions } from "@tanstack/react-query";
import type { Acao } from "@/components/form-acao";
import { acaoDaApi } from "@/lib/acao";
import { api } from "@/lib/api";
import { VALIDADE } from "@/lib/consulta";
import { chavesCom } from "./chaves";

// Comercial › Relacionamento (aniversários e registro de contatos). As ações
// têm os nomes das Server Actions de antes (acoes/contatos).

const BASE = "/comercial/relacionamento";

const buscarConfig = (sinal?: AbortSignal) =>
  api.get(`${BASE}/config`, {
    esquema: respostaConfigRelacionamento,
    sinal,
  });
const buscarLocatarios = (sinal?: AbortSignal) =>
  api.get(`${BASE}/locatarios`, { esquema: respostaLocatarios, sinal });
const buscarContatos = (filtros: Record<string, string>, sinal?: AbortSignal) =>
  api.get(`${BASE}/contatos`, {
    esquema: respostaContatos,
    consulta: filtros,
    sinal,
  });

/** GET /api/v1/comercial/relacionamento/config */
export const consultaConfigRelacionamento = queryOptions({
  queryKey: chavesCom.configRelacionamento(),
  queryFn: ({ signal }) => buscarConfig(signal),
  staleTime: VALIDADE.configuracao,
});

/** GET /api/v1/comercial/relacionamento/locatarios */
export const consultaLocatarios = queryOptions({
  queryKey: chavesCom.locatarios(),
  queryFn: ({ signal }) => buscarLocatarios(signal),
});

// As telas que pedem só o que a pessoa pode ver (null sem a permissão),
// como o `registra ? … : null` das páginas de antes.

/** Config do relacionamento, ou null quando `sim` é false. */
export const consultaConfigSe = (sim: boolean) =>
  queryOptions({
    queryKey: [...chavesCom.configRelacionamento(), sim],
    queryFn: ({ signal }) => (sim ? buscarConfig(signal) : null),
    staleTime: VALIDADE.configuracao,
  });

/** Locatários para o formulário, ou null quando `sim` é false. */
export const consultaLocatariosSe = (sim: boolean) =>
  queryOptions({
    queryKey: [...chavesCom.locatarios(), sim],
    queryFn: ({ signal }) => (sim ? buscarLocatarios(signal) : null),
  });

/** Contatos do filtro, ou null quando `sim` é false. */
export const consultaContatosSe = (
  sim: boolean,
  filtros: Record<string, string>,
) =>
  queryOptions({
    queryKey: [...chavesCom.contatos(filtros), sim],
    queryFn: ({ signal }) => (sim ? buscarContatos(filtros, signal) : null),
  });

const buscarAniversarios = (mes: number | null, sinal?: AbortSignal) =>
  api.get(`${BASE}/aniversarios`, {
    esquema: respostaAniversarios,
    consulta: { mes },
    sinal,
  });

/** GET /api/v1/comercial/relacionamento/aniversarios?mes= */
export const consultaAniversarios = (mes: number | null) =>
  queryOptions({
    queryKey: chavesCom.aniversarios(mes),
    queryFn: ({ signal }) => buscarAniversarios(mes, signal),
  });

/** Aniversários do mês, ou null quando `sim` é false (outra aba). */
export const consultaAniversariosSe = (sim: boolean, mes: number | null) =>
  queryOptions({
    queryKey: [...chavesCom.aniversarios(mes), sim],
    queryFn: ({ signal }) => (sim ? buscarAniversarios(mes, signal) : null),
  });

/** GET /api/v1/comercial/relacionamento/contatos?periodo=&tipo=&bloco=&cliente= */
export const consultaContatos = (filtros: Record<string, string>) =>
  queryOptions({
    queryKey: chavesCom.contatos(filtros),
    queryFn: ({ signal }) => buscarContatos(filtros, signal),
  });

/** GET /api/v1/comercial/relacionamento/contatos/:id */
export const consultaContato = (id: string) =>
  queryOptions({
    queryKey: chavesCom.contato(id),
    queryFn: ({ signal }) =>
      api.get(`${BASE}/contatos/${encodeURIComponent(id)}`, {
        esquema: respostaContato,
        sinal: signal,
      }),
  });

const invalida = [chavesCom.relacionamento];
const doContato = (form: FormData) =>
  `${BASE}/contatos/${encodeURIComponent(String(form.get("id") ?? ""))}`;

/** POST /api/v1/comercial/relacionamento/contatos */
export const registrarContato: Acao = acaoDaApi({
  metodo: "POST",
  caminho: `${BASE}/contatos`,
  invalida,
});

/** POST /api/v1/comercial/relacionamento/sac/sincronizar */
export const sincronizarSac: Acao = acaoDaApi({
  metodo: "POST",
  caminho: `${BASE}/sac/sincronizar`,
  invalida,
});

/** PATCH /api/v1/comercial/relacionamento/contatos/:id (o id vem no formulário). */
export const editarContato: Acao = acaoDaApi({
  metodo: "PATCH",
  caminho: doContato,
  invalida,
});

/**
 * DELETE /api/v1/comercial/relacionamento/contatos/:id. Antes a ação
 * redirecionava para a aba Contatos; aqui quem usa passa a navegação.
 */
export const excluirContato = (depois: () => void): Acao =>
  acaoDaApi({
    metodo: "DELETE",
    caminho: doContato,
    invalida,
    aoGravar: depois,
  });
