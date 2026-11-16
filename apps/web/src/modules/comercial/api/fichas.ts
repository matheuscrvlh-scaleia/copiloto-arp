import {
  type EstadoDaFicha,
  type EstadoDoDocumento,
  estadoDaFicha,
  estadoDoDocumento,
  respostaDemonstracaoFicha,
  respostaDetalheFicha,
  respostaFichaPublica,
  respostaFichas,
  respostaLinkFicha,
} from "@arp/shared/comercial/contratos/fichas";
import { queryOptions } from "@tanstack/react-query";
import type { Acao, EstadoAcao } from "@/components/form-acao";
import { acaoDaApi, formParaObjeto } from "@/lib/acao";
import { api, BASE_DA_API, ErroDaApi, mensagemDoErro } from "@/lib/api";
import { clienteDeConsultas } from "@/lib/consulta";
import { chavesCom } from "./chaves";

// Comercial › Fichas cadastrais (a tela interna) e a ficha pelo link (sem
// login). As ações têm os nomes e os retornos das Server Actions de antes
// (acoes/fichas e acoes/ficha-publica).

const BASE = "/comercial/fichas";

/** GET /api/v1/comercial/fichas?desde=&tipo= */
export const consultaFichas = (desde: string | null, tipo: string | null) =>
  queryOptions({
    queryKey: chavesCom.listaFichas(desde ?? "", tipo ?? ""),
    queryFn: ({ signal }) =>
      api.get(BASE, {
        esquema: respostaFichas,
        consulta: { desde, tipo },
        sinal: signal,
      }),
  });

/** GET /api/v1/comercial/fichas/demonstracao */
export const consultaDemonstracaoFicha = queryOptions({
  queryKey: chavesCom.demonstracaoFicha(),
  queryFn: ({ signal }) =>
    api.get(`${BASE}/demonstracao`, {
      esquema: respostaDemonstracaoFicha,
      sinal: signal,
    }),
});

/** GET /api/v1/comercial/fichas/:id (registra que abriu, com formulario.ver). */
export const consultaFicha = (id: string) =>
  queryOptions({
    queryKey: chavesCom.ficha(id),
    queryFn: ({ signal }) =>
      api.get(`${BASE}/${encodeURIComponent(id)}`, {
        esquema: respostaDetalheFicha,
        sinal: signal,
      }),
  });

/** "Ficha cadastral em PDF" (antes /comercial/fichas/:id/pdf). */
export const linkDoPdfDaFicha = (id: string) =>
  `${BASE_DA_API}${BASE}/${encodeURIComponent(id)}/pdf`;

/** Documento comprobatório (antes /comercial/fichas/:id/documento/:doc). */
export const linkDoDocumentoDaFicha = (id: string, doc: string) =>
  `${BASE_DA_API}${BASE}/${encodeURIComponent(id)}/documento/${encodeURIComponent(doc)}`;

export interface EstadoDoLink extends EstadoAcao {
  /** Endereço para enviar ao interessado. */
  link?: string;
  /** "dd/mm/aaaa". */
  validoAte?: string;
}

const atualizar = () =>
  clienteDeConsultas
    .invalidateQueries({ queryKey: chavesCom.fichas })
    .catch(() => {});

async function comLink(caminho: string, corpo: unknown): Promise<EstadoDoLink> {
  try {
    const r = await api.post(caminho, corpo, { esquema: respostaLinkFicha });
    await atualizar();
    return { ok: r.mensagem, link: r.link, validoAte: r.validoAte };
  } catch (erro) {
    return { erro: mensagemDoErro(erro) };
  }
}

/** "Gerar link": POST /api/v1/comercial/fichas/links. */
export async function gerarLinkFicha(
  _: EstadoDoLink,
  form: FormData,
): Promise<EstadoDoLink> {
  return comLink(`${BASE}/links`, formParaObjeto(form));
}

/** "Reenviar" / "Renovar validade": POST /api/v1/comercial/fichas/:id/reenviar. */
export async function reenviarLinkFicha(
  _: EstadoDoLink,
  form: FormData,
): Promise<EstadoDoLink> {
  const id = encodeURIComponent(String(form.get("id") ?? ""));
  return comLink(`${BASE}/${id}/reenviar`, undefined);
}

/** "Cancelar link": POST /api/v1/comercial/fichas/:id/cancelar. */
export const cancelarLinkFicha: Acao = acaoDaApi({
  metodo: "POST",
  caminho: (form) =>
    `${BASE}/${encodeURIComponent(String(form.get("id") ?? ""))}/cancelar`,
  corpo: () => undefined,
  invalida: [chavesCom.fichas],
});

// ---------------------------------------------------------------------------
// Pelo link (sem login): /api/v1/ficha/:token
// ---------------------------------------------------------------------------

const PUBLICA = "/ficha";
const doToken = (form: FormData) =>
  `${PUBLICA}/${encodeURIComponent(String(form.get("token") ?? ""))}`;

/** GET /api/v1/ficha/:token (a página: o link ou o motivo de não valer). */
export const consultaFichaPublica = (token: string) =>
  queryOptions({
    queryKey: ["ficha-publica", token],
    queryFn: ({ signal }) =>
      api.get(`${PUBLICA}/${encodeURIComponent(token)}`, {
        esquema: respostaFichaPublica,
        sinal: signal,
      }),
    staleTime: 0,
  });

/** Erro da API vira estado; falha de rede segue para quem chamou avisar. */
function estadoDoErro(erro: unknown): { erro: string } {
  if (erro instanceof ErroDaApi && erro.codigo !== "rede")
    return { erro: erro.mensagem };
  throw erro;
}

/** "Salvar e continuar depois" / "Enviar ficha": POST /api/v1/ficha/:token. */
export async function salvarFichaPeloLink(
  _: EstadoDaFicha,
  form: FormData,
): Promise<EstadoDaFicha> {
  try {
    return await api.post(
      doToken(form),
      {
        acao: form.get("acao") === "enviar" ? "enviar" : "salvar",
        respostas: String(form.get("respostas") ?? ""),
        ...(form.get("confirmar") ? { confirmar: "1" } : {}),
      },
      { esquema: estadoDaFicha },
    );
  } catch (erro) {
    return estadoDoErro(erro);
  }
}

/** Sobe um documento: POST /api/v1/ficha/:token/documentos (multipart). */
export async function enviarDocumentoPeloLink(
  form: FormData,
): Promise<EstadoDoDocumento> {
  const corpo = new FormData();
  for (const campo of ["tipo", "documento", "aceite"])
    corpo.set(campo, String(form.get(campo) ?? ""));
  const arquivo = form.get("arquivo");
  if (arquivo instanceof File) corpo.set("arquivo", arquivo);
  try {
    return await api.post(`${doToken(form)}/documentos`, corpo, {
      esquema: estadoDoDocumento,
    });
  } catch (erro) {
    return estadoDoErro(erro);
  }
}

/** Tira um documento: DELETE /api/v1/ficha/:token/documentos/:id. */
export async function removerDocumentoPeloLink(
  form: FormData,
): Promise<EstadoDoDocumento> {
  const id = encodeURIComponent(String(form.get("id") ?? ""));
  try {
    return await api.delete(`${doToken(form)}/documentos/${id}`, {
      esquema: estadoDoDocumento,
    });
  } catch (erro) {
    return estadoDoErro(erro);
  }
}
