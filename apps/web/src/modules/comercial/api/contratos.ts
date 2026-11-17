import type { StatusContrato } from "@arp/shared/comercial/contrato";
import { respostaMensagem } from "@arp/shared/comercial/contratos/base";
import {
  type Atualizacao,
  respostaApoioContrato,
  respostaContrato,
  respostaContratosEnet,
  respostaEnvioAnexo,
  respostaFichaCarregada,
  respostaGravacao,
  respostaLink,
  respostaListaContratos,
  respostaVistoria,
  respostaVistoriaPuxada,
  type VistoriaDoLuc,
} from "@arp/shared/comercial/contratos/contratos";
import {
  dadosDaFichaParaContrato,
  type PartesDaFicha,
} from "@arp/shared/comercial/ficha-para-contrato";
import { queryOptions } from "@tanstack/react-query";
import { api, ErroDaApi, mensagemDoErro } from "@/lib/api";
import { clienteDeConsultas, VALIDADE } from "@/lib/consulta";
import { chavesCom } from "./chaves";

// Comercial › Contratos (assistente de contrato e distrato). As funções de
// gravação têm os nomes e o formato de resposta das Server Actions de antes
// (acoes/contratos): devolvem { ok } / { erro } em vez de lançar, e os
// componentes copiados continuam iguais.

const BASE = "/comercial/contratos";

/** GET /api/v1/comercial/contratos?atualizacao= */
export const consultaListaContratos = (atualizacao: Atualizacao) =>
  queryOptions({
    queryKey: chavesCom.listaContratos(atualizacao),
    queryFn: ({ signal }) =>
      api.get(BASE, {
        esquema: respostaListaContratos,
        consulta: { atualizacao },
        sinal: signal,
      }),
  });

/** GET /api/v1/comercial/contratos/apoio */
export const consultaApoioContrato = queryOptions({
  queryKey: chavesCom.apoioContrato(),
  queryFn: ({ signal }) =>
    api.get(`${BASE}/apoio`, { esquema: respostaApoioContrato, sinal: signal }),
});

/** GET /api/v1/comercial/contratos/:id */
export const consultaContrato = (id: string) =>
  queryOptions({
    queryKey: chavesCom.contrato(id),
    queryFn: ({ signal }) =>
      api.get(`${BASE}/${encodeURIComponent(id)}`, {
        esquema: respostaContrato,
        sinal: signal,
      }),
  });

/**
 * O contrato da tela do assistente: null no contrato novo e quando não
 * existe (a tela mostra "Contrato não encontrado.", como antes).
 */
export const consultaContratoOuNada = (id: string | null) =>
  queryOptions({
    queryKey: [...chavesCom.contrato(id ?? ""), "ou-nada"],
    queryFn: async ({ signal }) => {
      if (!id) return null;
      try {
        return await api.get(`${BASE}/${encodeURIComponent(id)}`, {
          esquema: respostaContrato,
          sinal: signal,
        });
      } catch (e) {
        if (e instanceof ErroDaApi && e.status === 404) return null;
        throw e;
      }
    },
  });

/** GET /api/v1/comercial/contratos/distratos/enet */
export const consultaContratosEnet = queryOptions({
  queryKey: chavesCom.contratosEnet(),
  queryFn: ({ signal }) =>
    api.get(`${BASE}/distratos/enet`, {
      esquema: respostaContratosEnet,
      sinal: signal,
    }),
});

/** GET /api/v1/comercial/contratos/vistorias?luc=&tipo= */
export const consultaVistoria = (luc: string, tipo: "entrada" | "saida") =>
  queryOptions({
    queryKey: chavesCom.vistoria(luc, tipo),
    queryFn: ({ signal }) =>
      api.get(`${BASE}/vistorias`, {
        esquema: respostaVistoria,
        consulta: { luc, tipo },
        sinal: signal,
      }),
    staleTime: VALIDADE.negocio,
  });

// ---------------------------------------------------------------------------
// Gravação (formato das Server Actions de antes)
// ---------------------------------------------------------------------------

export interface RespostaContrato {
  ok?: string;
  erro?: string;
  id?: string;
  atualizadoEm?: string;
  status?: StatusContrato;
  versao?: number;
  fichaSolta?: boolean;
}

/** O `refresh()` de antes: as telas de contratos buscam de novo. */
const atualizar = () =>
  clienteDeConsultas
    .invalidateQueries({ queryKey: chavesCom.contratos })
    .catch(() => {});

async function gravar(
  pedido: () => Promise<unknown>,
): Promise<RespostaContrato> {
  try {
    const r = respostaGravacao.parse(await pedido());
    await atualizar();
    return {
      ok: r.mensagem,
      id: r.id,
      atualizadoEm: r.atualizadoEm,
      status: r.status,
      versao: r.versao,
      fichaSolta: r.fichaSolta,
    };
  } catch (e) {
    return { erro: mensagemDoErro(e) };
  }
}

/** POST /api/v1/comercial/contratos (cria ou salva a etapa). */
export function salvarContrato(entrada: {
  id: string | null;
  lido: string | null;
  etapa: number;
  dados: unknown;
}): Promise<RespostaContrato> {
  return gravar(() => api.post(BASE, entrada));
}

/** POST /api/v1/comercial/contratos/:id/pronto */
export function marcarPronto(entrada: {
  id: string;
  lido: string;
}): Promise<RespostaContrato> {
  return gravar(() =>
    api.post(`${BASE}/${encodeURIComponent(entrada.id)}/pronto`, {
      lido: entrada.lido,
    }),
  );
}

/** POST /api/v1/comercial/contratos/distratos */
export function salvarDistrato(entrada: {
  id: string | null;
  lido: string | null;
  dados: unknown;
}): Promise<RespostaContrato> {
  return gravar(() => api.post(`${BASE}/distratos`, entrada));
}

export type FichaCarregada =
  | { ok: true; ficha: PartesDaFicha; nome: string }
  | { ok: false; erro: string };

/** POST /api/v1/comercial/contratos/fichas/:id/carregar (registra o acesso). */
export async function carregarFicha(fichaId: string): Promise<FichaCarregada> {
  try {
    const r = await api.post(
      `${BASE}/fichas/${encodeURIComponent(fichaId)}/carregar`,
      undefined,
      { esquema: respostaFichaCarregada },
    );
    return { ok: true, nome: r.nome, ficha: dadosDaFichaParaContrato(r.ficha) };
  } catch (e) {
    return { ok: false, erro: mensagemDoErro(e) };
  }
}

export type VistoriaPuxada =
  | {
      ok: true;
      vistoria: VistoriaDoLuc;
      fisica: Partial<Record<string, string>>;
    }
  | { ok: false; erro: string };

/** POST /api/v1/comercial/contratos/vistoria-de-entrada */
export async function puxarVistoria(lucs: string[]): Promise<VistoriaPuxada> {
  try {
    const r = await api.post(
      `${BASE}/vistoria-de-entrada`,
      { lucs },
      { esquema: respostaVistoriaPuxada },
    );
    return { ok: true, vistoria: r.vistoria, fisica: r.fisica };
  } catch (e) {
    return { ok: false, erro: mensagemDoErro(e) };
  }
}

export type EnvioPreparado =
  | { ok: true; url: string; path: string }
  | { ok: false; erro: string };

/** POST /api/v1/comercial/contratos/:id/anexos/envio (link para o navegador enviar). */
export async function prepararAnexo(entrada: {
  contratoId: string;
  tipo: string;
  nome: string;
  tamanho: number;
}): Promise<EnvioPreparado> {
  const { contratoId, ...corpo } = entrada;
  try {
    const r = await api.post(
      `${BASE}/${encodeURIComponent(contratoId)}/anexos/envio`,
      corpo,
      { esquema: respostaEnvioAnexo },
    );
    return { ok: true, url: r.url, path: r.path };
  } catch (e) {
    return { ok: false, erro: mensagemDoErro(e) };
  }
}

async function comMensagem(
  pedido: () => Promise<unknown>,
): Promise<RespostaContrato> {
  try {
    const r = respostaMensagem.parse(await pedido());
    await atualizar();
    return { ok: r.mensagem };
  } catch (e) {
    return { erro: mensagemDoErro(e) };
  }
}

/** POST /api/v1/comercial/contratos/:id/anexos (depois do envio). */
export function registrarAnexo(entrada: {
  contratoId: string;
  tipo: string;
  path: string;
  nome: string;
}): Promise<RespostaContrato> {
  const { contratoId, ...corpo } = entrada;
  return comMensagem(() =>
    api.post(`${BASE}/${encodeURIComponent(contratoId)}/anexos`, corpo),
  );
}

/** DELETE /api/v1/comercial/contratos/anexos/:anexo */
export function removerAnexo(anexoId: string): Promise<RespostaContrato> {
  return comMensagem(() =>
    api.delete(`${BASE}/anexos/${encodeURIComponent(anexoId)}`),
  );
}

/** GET /api/v1/comercial/contratos/anexos/:anexo/link (link de 60 s). */
export async function linkDoAnexo(
  anexoId: string,
): Promise<{ url: string } | { erro: string }> {
  try {
    return await api.get(`${BASE}/anexos/${encodeURIComponent(anexoId)}/link`, {
      esquema: respostaLink,
    });
  } catch (e) {
    return { erro: mensagemDoErro(e) };
  }
}
