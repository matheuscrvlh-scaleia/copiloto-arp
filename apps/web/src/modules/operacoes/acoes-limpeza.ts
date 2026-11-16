import { respostaLinkDeEnvio } from "@arp/shared/operacoes/contratos/base";
import {
  respostaCriarMes,
  respostaLinkDoAnexo,
  respostaMesAnterior,
  respostaPreviaAbertaDoHistorico,
  respostaPreviaDoHistorico,
} from "@arp/shared/operacoes/contratos/limpeza";
import type { Lancamento } from "@arp/shared/operacoes/limpeza-lancamento";
import type { PreviaHistorico } from "@arp/shared/operacoes/limpeza-planilha";
import type { EstadoAcao } from "@/components/form-acao";
import { api, ErroDaApi, mensagemDoErro } from "@/lib/api";
import { executar, invalidar } from "./acoes";
import { chavesOp } from "./api";
import { chavesLimpeza } from "./api-limpeza";

// Gravações do rateio da limpeza pela API, com os nomes e a forma das
// Server Actions do sistema antigo (src/server/operacoes/acoes/limpeza.ts).

const RATEIO = [chavesLimpeza.tudo, chavesOp.painel()];
const IMPORTACAO = [...RATEIO, chavesOp.importacoes()];

const mes = (ref: string) => encodeURIComponent(ref.slice(0, 7));

export type EnvioPreparado =
  | { ok: true; url: string; caminho: string }
  | { ok: false; erro: string };

export type RespostaPrevia =
  | { ok: true; previa: PreviaHistorico }
  | { ok: false; erro: string };

// ---------------------------------------------------------------------------
// Lançamento do mês
// ---------------------------------------------------------------------------

export function salvarRateio(l: Lancamento): Promise<EstadoAcao> {
  return executar(
    () => api.put(`/operacoes/limpeza/meses/${mes(l.referencia)}`, l),
    RATEIO,
  );
}

export async function criarMes(entrada: {
  referencia: string;
  copiar: boolean;
}): Promise<EstadoAcao & { referencia?: string }> {
  try {
    const r = await api.post("/operacoes/limpeza/meses", entrada, {
      esquema: respostaCriarMes,
    });
    await invalidar(RATEIO);
    return { ok: r.mensagem, referencia: r.referencia };
  } catch (e) {
    // Mês que já existe: abre ele.
    const ja = e instanceof ErroDaApi && e.codigo === "conflito";
    return {
      erro: mensagemDoErro(e),
      ...(ja ? { referencia: `${entrada.referencia.slice(0, 7)}-01` } : {}),
    };
  }
}

export async function lancamentoDoMesAnterior(
  referencia: string,
): Promise<
  { ok: true; lancamento: Lancamento; de: string } | { ok: false; erro: string }
> {
  try {
    const r = await api.get(
      `/operacoes/limpeza/meses/${mes(referencia)}/anterior`,
      { esquema: respostaMesAnterior },
    );
    return { ok: true, ...r };
  } catch (e) {
    return { ok: false, erro: mensagemDoErro(e) };
  }
}

// ---------------------------------------------------------------------------
// Fechar, reabrir e enviar ao Financeiro
// ---------------------------------------------------------------------------

export function fecharRateio(referencia: string): Promise<EstadoAcao> {
  return executar(
    () => api.post(`/operacoes/limpeza/meses/${mes(referencia)}/fechar`),
    RATEIO,
  );
}

export function reabrirRateio(
  referencia: string,
  motivo: string,
): Promise<EstadoAcao> {
  return executar(
    () =>
      api.post(`/operacoes/limpeza/meses/${mes(referencia)}/reabrir`, {
        motivo,
      }),
    RATEIO,
  );
}

export function enviarRateio(referencia: string): Promise<EstadoAcao> {
  return executar(
    () => api.post(`/operacoes/limpeza/meses/${mes(referencia)}/enviar`),
    RATEIO,
  );
}

// ---------------------------------------------------------------------------
// Anexos do mês
// ---------------------------------------------------------------------------

export async function prepararAnexoRateio(entrada: {
  referencia: string;
  tipo: string;
  nome: string;
  tamanho: number;
}): Promise<EnvioPreparado> {
  try {
    const { referencia, ...corpo } = entrada;
    const r = await api.post(
      `/operacoes/limpeza/meses/${mes(referencia)}/anexos/envio`,
      corpo,
      { esquema: respostaLinkDeEnvio },
    );
    return { ok: true, ...r };
  } catch (e) {
    return { ok: false, erro: mensagemDoErro(e) };
  }
}

export function registrarAnexoRateio(entrada: {
  referencia: string;
  tipo: string;
  caminho: string;
  nome: string;
}): Promise<EstadoAcao> {
  const { referencia, ...corpo } = entrada;
  return executar(
    () => api.post(`/operacoes/limpeza/meses/${mes(referencia)}/anexos`, corpo),
    RATEIO,
  );
}

export function removerAnexoRateio(id: string): Promise<EstadoAcao> {
  return executar(
    () => api.delete(`/operacoes/limpeza/anexos/${encodeURIComponent(id)}`),
    RATEIO,
  );
}

export async function linkDoAnexoRateio(
  id: string,
): Promise<{ url: string } | { erro: string }> {
  try {
    return await api.get(
      `/operacoes/limpeza/anexos/${encodeURIComponent(id)}/link`,
      { esquema: respostaLinkDoAnexo },
    );
  } catch (e) {
    return { erro: mensagemDoErro(e) };
  }
}

// ---------------------------------------------------------------------------
// Importação do histórico
// ---------------------------------------------------------------------------

export async function prepararEnvioHistorico(entrada: {
  nome: string;
  tamanho: number;
}): Promise<EnvioPreparado> {
  try {
    const r = await api.post("/operacoes/limpeza/historico/envio", entrada, {
      esquema: respostaLinkDeEnvio,
    });
    return { ok: true, ...r };
  } catch (e) {
    return { ok: false, erro: mensagemDoErro(e) };
  }
}

export async function previaHistorico(entrada: {
  caminho: string;
  nome: string;
}): Promise<RespostaPrevia> {
  try {
    const r = await api.post("/operacoes/limpeza/historico/previa", entrada, {
      esquema: respostaPreviaDoHistorico,
    });
    await invalidar([chavesOp.importacoes()]);
    return { ok: true, previa: r.previa };
  } catch (e) {
    return { ok: false, erro: mensagemDoErro(e) };
  }
}

export async function previaAbertaHistorico(): Promise<PreviaHistorico | null> {
  try {
    const r = await api.get("/operacoes/limpeza/historico/previa-aberta", {
      esquema: respostaPreviaAbertaDoHistorico,
    });
    return r.previa;
  } catch {
    return null;
  }
}

export function confirmarHistorico(entrada: {
  id: string;
  motivo?: string;
}): Promise<EstadoAcao> {
  return executar(
    () =>
      api.post(
        `/operacoes/limpeza/historico/${encodeURIComponent(entrada.id)}/confirmar`,
        { motivo: entrada.motivo },
      ),
    IMPORTACAO,
  );
}

export function descartarHistorico(id: string): Promise<EstadoAcao> {
  return executar(
    () =>
      api.post(
        `/operacoes/limpeza/historico/${encodeURIComponent(id)}/descartar`,
      ),
    [chavesOp.importacoes()],
  );
}
