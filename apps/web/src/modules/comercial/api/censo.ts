import { respostaMensagem } from "@arp/shared/comercial/contratos/base";
import {
  respostaCenso,
  respostaCensoPublico,
  respostaConviteCenso,
  respostaFeedbacksCenso,
  respostaIndicadoresCenso,
  respostaQuestionarioCenso,
  respostaRodadaCenso,
  respostaRodadasCenso,
} from "@arp/shared/comercial/contratos/censo";
import { queryOptions } from "@tanstack/react-query";
import type { Acao, EstadoAcao } from "@/components/form-acao";
import { acaoDaApi, formParaObjeto } from "@/lib/acao";
import { api, BASE_DA_API, ErroDaApi, mensagemDoErro } from "@/lib/api";
import { clienteDeConsultas, VALIDADE } from "@/lib/consulta";
import { chavesCom } from "./chaves";

// Comercial › Censo e o questionário pelo link (sem login). As ações têm os
// nomes das Server Actions de antes (acoes/censo).

const BASE = "/comercial/censo";

/** GET /api/v1/comercial/censo (rodadas e as listas dos filtros) */
export const consultaCenso = queryOptions({
  queryKey: chavesCom.telaCenso(),
  queryFn: ({ signal }) =>
    api.get(BASE, { esquema: respostaCenso, sinal: signal }),
});

/** GET /api/v1/comercial/censo/indicadores */
export const consultaIndicadoresCenso = queryOptions({
  queryKey: chavesCom.indicadoresCenso(),
  queryFn: ({ signal }) =>
    api.get(`${BASE}/indicadores`, {
      esquema: respostaIndicadoresCenso,
      sinal: signal,
    }),
});

/** GET /api/v1/comercial/censo/feedbacks?rodada=&origem= */
export const consultaFeedbacksCenso = (rodada: string, origem: string) =>
  queryOptions({
    queryKey: chavesCom.feedbacksCenso(rodada, origem),
    queryFn: ({ signal }) =>
      api.get(`${BASE}/feedbacks`, {
        esquema: respostaFeedbacksCenso,
        consulta: { rodada, origem: origem || null },
        sinal: signal,
      }),
  });

/** GET /api/v1/comercial/censo/rodadas (convites e respostas de cada rodada) */
export const consultaRodadasCenso = queryOptions({
  queryKey: chavesCom.rodadasCenso(),
  queryFn: ({ signal }) =>
    api.get(`${BASE}/rodadas`, {
      esquema: respostaRodadasCenso,
      sinal: signal,
    }),
});

/** GET /api/v1/comercial/censo/rodadas/:id, ou null sem rodada. */
export const consultaRodadaCenso = (id: string | null) =>
  queryOptions({
    queryKey: chavesCom.rodadaCenso(id ?? ""),
    queryFn: ({ signal }) =>
      id
        ? api.get(`${BASE}/rodadas/${encodeURIComponent(id)}`, {
            esquema: respostaRodadaCenso,
            sinal: signal,
          })
        : null,
  });

/** GET /api/v1/comercial/censo/demonstracao (opções do questionário) */
export const consultaQuestionarioCenso = queryOptions({
  queryKey: chavesCom.questionarioCenso(),
  queryFn: ({ signal }) =>
    api.get(`${BASE}/demonstracao`, {
      esquema: respostaQuestionarioCenso,
      sinal: signal,
    }),
  staleTime: VALIDADE.configuracao,
});

/** GET /api/v1/comercial/censo/presencial/:convite */
export const consultaPresencialCenso = (convite: string) =>
  queryOptions({
    queryKey: chavesCom.presencialCenso(convite),
    queryFn: ({ signal }) =>
      api.get(`${BASE}/presencial/${encodeURIComponent(convite)}`, {
        esquema: respostaConviteCenso,
        sinal: signal,
      }),
  });

/** GET /api/v1/censo/:token (o questionário pelo link, sem login) */
export const consultaCensoPublico = (token: string) =>
  queryOptions({
    queryKey: ["censo-publico", token],
    queryFn: ({ signal }) =>
      api.get(`/censo/${encodeURIComponent(token)}`, {
        esquema: respostaCensoPublico,
        sinal: signal,
      }),
    staleTime: 0,
  });

/** "Panorama em PDF" (antes /comercial/censo/panorama?rodada=&bloco=&segmento=). */
export const linkDoPanorama = (consulta: string) =>
  `${BASE_DA_API}${BASE}/panorama${consulta ? `?${consulta}` : ""}`;

const invalida = [chavesCom.censo];

export interface EstadoQuestionario extends EstadoAcao {
  /** Erro de cada pergunta, pelo nome do campo. */
  erros?: Record<string, string>;
}

/**
 * Envia (ou corrige) a resposta. modo=link: POST /api/v1/censo/:token;
 * presencial ou demonstração: POST /api/v1/comercial/censo/respostas.
 */
export async function enviarRespostaCenso(
  _: EstadoQuestionario,
  form: FormData,
): Promise<EstadoQuestionario> {
  const corpo = formParaObjeto(form, { listas: ["expectativas"] });
  const link = form.get("modo") === "link";
  const caminho = link
    ? `/censo/${encodeURIComponent(String(form.get("token") ?? ""))}`
    : `${BASE}/respostas`;
  try {
    const r = await api.post(caminho, corpo, { esquema: respostaMensagem });
    if (!link)
      await Promise.all(
        invalida.map((queryKey) =>
          clienteDeConsultas.invalidateQueries({ queryKey }).catch(() => {}),
        ),
      );
    return { ok: r.mensagem };
  } catch (erro) {
    if (erro instanceof ErroDaApi && erro.campos)
      return { erro: erro.mensagem, erros: erro.campos };
    return { erro: mensagemDoErro(erro) };
  }
}

/** POST /api/v1/comercial/censo/rodadas */
export const abrirRodada: Acao = acaoDaApi({
  metodo: "POST",
  caminho: `${BASE}/rodadas`,
  invalida,
});

const daRodada = (form: FormData) =>
  `${BASE}/rodadas/${encodeURIComponent(String(form.get("rodada") ?? ""))}`;

/** POST /api/v1/comercial/censo/rodadas/:id/convites (a rodada vem no formulário). */
export const gerarConvites: Acao = acaoDaApi({
  metodo: "POST",
  caminho: (form) => `${daRodada(form)}/convites`,
  corpo: () => undefined,
  invalida,
});

/** POST /api/v1/comercial/censo/rodadas/:id/encerrar */
export const encerrarRodada: Acao = acaoDaApi({
  metodo: "POST",
  caminho: (form) => `${daRodada(form)}/encerrar`,
  corpo: () => undefined,
  invalida,
});

/** Marca que o link foi copiado (quadro: "Enviado, sem resposta"). */
export async function marcarConviteEnviado(id: string): Promise<void> {
  try {
    await api.post(`${BASE}/convites/${encodeURIComponent(id)}/enviado`);
    await clienteDeConsultas
      .invalidateQueries({ queryKey: chavesCom.censo })
      .catch(() => {});
  } catch {
    // Como antes: a marca é um auxílio; o link já foi copiado.
  }
}

/** POST /api/v1/comercial/censo/sugestoes/mover */
export const moverSugestao: Acao = acaoDaApi({
  metodo: "POST",
  caminho: `${BASE}/sugestoes/mover`,
  invalida,
});

/** POST /api/v1/comercial/censo/temas */
export const salvarTema: Acao = acaoDaApi({
  metodo: "POST",
  caminho: `${BASE}/temas`,
  invalida,
});
