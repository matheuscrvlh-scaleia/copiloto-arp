import {
  type RespostaEditor,
  respostaEditor,
  respostaEditorDados,
  respostaQuestionario,
  respostaVersao,
} from "@arp/shared/sustentabilidade/contratos/formularios";
import type { Operacao } from "@arp/shared/sustentabilidade/editor-operacoes";
import type { DefinicaoFormulario } from "@arp/shared/sustentabilidade/formulario/tipos";
import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { clienteDeConsultas } from "@/lib/consulta";
import { chavesSustentabilidade } from "./api";

// Editor dos formulários específicos na tela
// (/api/v1/sustentabilidade/formularios). As gravações respondem `{ ok }` ou
// `{ erro, podeInativar?, erros? }`, como as ações do sistema antigo; a lista
// de formulários de um programa está em ./api-programas.ts.

export type {
  AlteracaoDoEditor,
  DadosEditor,
  RespostaEditor,
  VersaoDoEditor,
} from "@arp/shared/sustentabilidade/contratos/formularios";

/** GET /sustentabilidade/formularios/questionario: id do questionário da entrevista. */
export const consultaDoQuestionario = queryOptions({
  queryKey: [...chavesSustentabilidade.formularios(), "questionario"],
  queryFn: ({ signal }) =>
    api.get("/sustentabilidade/formularios/questionario", {
      esquema: respostaQuestionario,
      sinal: signal,
    }),
  select: (r) => r.id,
});

/** GET /sustentabilidade/formularios/:id/editor (sem cache: duas pessoas podem estar editando). */
export const consultaDoEditor = (id: string) =>
  queryOptions({
    queryKey: chavesSustentabilidade.editor(id),
    queryFn: ({ signal }) =>
      api.get(`/sustentabilidade/formularios/${id}/editor`, {
        esquema: respostaEditorDados,
        sinal: signal,
      }),
    staleTime: 0,
  });

/**
 * Depois de gravar (ou de um conflito), busca o rascunho de novo: o
 * `refresh()` de antes. Espera a tela receber o dado novo.
 */
async function gravar(
  pedido: () => Promise<RespostaEditor>,
): Promise<RespostaEditor> {
  const r = await pedido();
  await clienteDeConsultas
    .invalidateQueries({ queryKey: chavesSustentabilidade.formularios() })
    .catch(() => {});
  return r;
}

const opcoes = { esquema: respostaEditor };
const base = (id: string) => `/sustentabilidade/formularios/${id}`;

/** Uma operação do editor (criar, editar, mover, inativar, excluir...). */
export const alterarRascunho = (e: {
  formularioId: string;
  atualizadoEm: string;
  operacao: Operacao;
}) =>
  gravar(() =>
    api.post(
      `${base(e.formularioId)}/rascunho`,
      { atualizadoEm: e.atualizadoEm, operacao: e.operacao },
      opcoes,
    ),
  );

/** Volta o rascunho à versão publicada. */
export const descartarRascunho = (e: {
  formularioId: string;
  atualizadoEm: string;
}) =>
  gravar(() =>
    api.post(
      `${base(e.formularioId)}/rascunho/descartar`,
      { atualizadoEm: e.atualizadoEm },
      opcoes,
    ),
  );

/** Versão antiga como novo rascunho. */
export const restaurarComoRascunho = (e: {
  formularioId: string;
  atualizadoEm: string;
  versao: number;
}) =>
  gravar(() =>
    api.post(
      `${base(e.formularioId)}/rascunho/restaurar`,
      { atualizadoEm: e.atualizadoEm, versao: e.versao },
      opcoes,
    ),
  );

/** Confere e publica a versão N + 1. */
export const publicarFormulario = (e: {
  formularioId: string;
  atualizadoEm: string;
  resumo: string;
}) =>
  gravar(async () => {
    const r = await api.post(
      `${base(e.formularioId)}/publicar`,
      { atualizadoEm: e.atualizadoEm, resumo: e.resumo },
      opcoes,
    );
    // Versão nova: lançamento, link do parceiro e entrevista usam a publicada.
    if (r.ok)
      await clienteDeConsultas
        .invalidateQueries({ queryKey: chavesSustentabilidade.tudo })
        .catch(() => {});
    return r;
  });

/** Definição de uma versão, para abrir só para leitura. */
export function lerVersao(
  formularioId: string,
  versao: number,
): Promise<{ definicao?: DefinicaoFormulario; erro?: string }> {
  return api.get(`${base(formularioId)}/versoes/${versao}`, {
    esquema: respostaVersao,
  });
}
