import { respostaMensagem } from "@arp/shared/comercial/contratos/base";
import {
  type EntradaArquivoKit,
  type EntradaNovoDocumentoKit,
  respostaDocumentoKit,
  respostaDocumentoKitCriado,
  respostaEnvioKit,
  respostaKit,
} from "@arp/shared/comercial/contratos/kit";
import { queryOptions } from "@tanstack/react-query";
import type { Acao, EstadoAcao } from "@/components/form-acao";
import { acaoDaApi } from "@/lib/acao";
import { api, BASE_DA_API, mensagemDoErro } from "@/lib/api";
import { clienteDeConsultas } from "@/lib/consulta";
import { chavesCom } from "./chaves";

// Comercial › Kit de entrega. As funções têm os nomes e os retornos das
// Server Actions de antes (acoes/kit): o formulário de envio continua igual.

const BASE = "/comercial/kit";

/** GET /api/v1/comercial/kit */
export const consultaKit = queryOptions({
  queryKey: chavesCom.telaKit(),
  queryFn: ({ signal }) =>
    api.get(BASE, { esquema: respostaKit, sinal: signal }),
});

/** GET /api/v1/comercial/kit/documentos/:id */
export const consultaDocumentoKit = (id: string) =>
  queryOptions({
    queryKey: chavesCom.documentoKit(id),
    queryFn: ({ signal }) =>
      api.get(`${BASE}/documentos/${encodeURIComponent(id)}`, {
        esquema: respostaDocumentoKit,
        sinal: signal,
      }),
  });

/** Baixar uma versão (antes /comercial/kit/arquivo/:id). */
export const linkDaVersao = (id: string) =>
  `${BASE_DA_API}${BASE}/arquivo/${encodeURIComponent(id)}`;

/** "Baixar kit do LUC" (antes /comercial/kit/luc?luc=). */
export const linkDoKitDoLuc = (luc: string) =>
  `${BASE_DA_API}${BASE}/luc?luc=${encodeURIComponent(luc)}`;

const atualizar = () =>
  clienteDeConsultas
    .invalidateQueries({ queryKey: chavesCom.kit })
    .catch(() => {});

export type DocumentoCriado =
  | { ok: true; documentoId: string; versaoId: string }
  | { ok: false; erro: string };

/** POST /api/v1/comercial/kit/documentos (documento e a primeira versão, sem arquivo). */
export async function novoDocumentoKit(
  entrada: EntradaNovoDocumentoKit,
): Promise<DocumentoCriado> {
  try {
    const r = await api.post(`${BASE}/documentos`, entrada, {
      esquema: respostaDocumentoKitCriado,
    });
    await atualizar();
    return { ok: true, documentoId: r.documentoId, versaoId: r.versaoId };
  } catch (erro) {
    return { ok: false, erro: mensagemDoErro(erro) };
  }
}

export type EnvioPreparado =
  | { ok: true; url: string; path: string }
  | { ok: false; erro: string };

/** POST /api/v1/comercial/kit/documentos/:id/envio (link de envio do PDF). */
export async function prepararEnvioKit(entrada: {
  documentoId: string;
  nome: string;
  tamanho: number;
}): Promise<EnvioPreparado> {
  try {
    const r = await api.post(
      `${BASE}/documentos/${encodeURIComponent(entrada.documentoId)}/envio`,
      { nome: entrada.nome, tamanho: entrada.tamanho },
      { esquema: respostaEnvioKit },
    );
    return { ok: true, url: r.url, path: r.path };
  } catch (erro) {
    return { ok: false, erro: mensagemDoErro(erro) };
  }
}

/** POST /api/v1/comercial/kit/documentos/:id/arquivo (confere e registra). */
export async function registrarArquivoKit(
  entrada: EntradaArquivoKit & { documentoId: string },
): Promise<EstadoAcao> {
  const { documentoId, ...corpo } = entrada;
  try {
    const r = await api.post(
      `${BASE}/documentos/${encodeURIComponent(documentoId)}/arquivo`,
      corpo,
      { esquema: respostaMensagem },
    );
    await atualizar();
    return { ok: r.mensagem };
  } catch (erro) {
    return { erro: mensagemDoErro(erro) };
  }
}

/** PATCH /api/v1/comercial/kit/documentos/:id (o id vem no formulário). */
export const editarDocumentoKit: Acao = acaoDaApi({
  metodo: "PATCH",
  caminho: (form) =>
    `${BASE}/documentos/${encodeURIComponent(String(form.get("id") ?? ""))}`,
  invalida: [chavesCom.kit],
});
