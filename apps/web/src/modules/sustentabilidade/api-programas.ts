import type { RespostaMensagem } from "@arp/shared/contratos/auth";
import {
  type RespostaFormulario,
  respostaFormulario,
  respostaFormulariosDoPrograma,
} from "@arp/shared/sustentabilidade/contratos/formularios";
import {
  type EnvioDoFormulario,
  respostaCorrecao,
  respostaLancamentos,
} from "@arp/shared/sustentabilidade/contratos/lancamentos";
import { respostaParceiro } from "@arp/shared/sustentabilidade/contratos/parceiro";
import {
  respostaIndicadores,
  respostaLinkGerado,
  respostaLinks,
  respostaPrograma,
  respostaProgramaCriado,
  respostaProgramas,
  respostaResumo,
} from "@arp/shared/sustentabilidade/contratos/programas";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { acaoDaApi } from "@/lib/acao";
import { api, ErroDaApi, mensagemDoErro } from "@/lib/api";
import { clienteDeConsultas, VALIDADE } from "@/lib/consulta";
import { chavesSustentabilidade } from "./api";

// Programas, lançamentos e link do parceiro na tela (spec 4.8). As chaves
// começam por "sustentabilidade"; os lançamentos ficam sob a chave
// `lancamentos` da base (as importações também a invalidam).

const comMensagem = z.object({ mensagem: z.string() });

export const chavesProgramas = {
  tudo: ["sustentabilidade", "programas"] as const,
  lista: (mes: string) =>
    ["sustentabilidade", "programas", "lista", mes] as const,
  programa: (id: string) => ["sustentabilidade", "programas", id] as const,
  resumo: (id: string, mes: string) =>
    ["sustentabilidade", "programas", id, "resumo", mes] as const,
  indicadores: (id: string) =>
    ["sustentabilidade", "programas", id, "indicadores"] as const,
  links: (id: string) =>
    ["sustentabilidade", "programas", id, "links"] as const,
  lancamentos: (id: string, mes: string) =>
    [...chavesSustentabilidade.lancamentos(), id, mes] as const,
  parceiro: (token: string) => ["sustentabilidade", "parceiro", token] as const,
};

/** Tudo que um lançamento muda: listas, resumos e indicadores. */
const invalidarLancamentos = () =>
  Promise.all([
    clienteDeConsultas.invalidateQueries({
      queryKey: chavesSustentabilidade.lancamentos(),
    }),
    clienteDeConsultas.invalidateQueries({ queryKey: chavesProgramas.tudo }),
  ]);

// ---------------------------------------------------------------- leituras

/** GET /sustentabilidade/programas?mes=aaaa-mm */
export const consultaDosProgramas = (mes: string) =>
  queryOptions({
    queryKey: chavesProgramas.lista(mes),
    queryFn: ({ signal }) =>
      api.get("/sustentabilidade/programas", {
        esquema: respostaProgramas,
        consulta: { mes },
        sinal: signal,
      }),
  });

/** GET /sustentabilidade/programas/:id */
export const consultaDoPrograma = (id: string) =>
  queryOptions({
    queryKey: chavesProgramas.programa(id),
    queryFn: ({ signal }) =>
      api.get(`/sustentabilidade/programas/${id}`, {
        esquema: respostaPrograma,
        sinal: signal,
      }),
  });

/** GET /sustentabilidade/programas/:id/resumo?mes=aaaa-mm */
export const consultaDoResumo = (id: string, mes: string) =>
  queryOptions({
    queryKey: chavesProgramas.resumo(id, mes),
    queryFn: ({ signal }) =>
      api.get(`/sustentabilidade/programas/${id}/resumo`, {
        esquema: respostaResumo,
        consulta: { mes },
        sinal: signal,
      }),
  });

/** GET /sustentabilidade/programas/:id/indicadores */
export const consultaDosIndicadores = (id: string) =>
  queryOptions({
    queryKey: chavesProgramas.indicadores(id),
    queryFn: ({ signal }) =>
      api.get(`/sustentabilidade/programas/${id}/indicadores`, {
        esquema: respostaIndicadores,
        sinal: signal,
      }),
    staleTime: VALIDADE.configuracao,
  });

/** GET /sustentabilidade/programas/:id/links */
export const consultaDosLinks = (id: string) =>
  queryOptions({
    queryKey: chavesProgramas.links(id),
    queryFn: ({ signal }) =>
      api.get(`/sustentabilidade/programas/${id}/links`, {
        esquema: respostaLinks,
        sinal: signal,
      }),
    select: (r) => r.links,
  });

/** GET /sustentabilidade/programas/:id/lancamentos?mes=aaaa-mm */
export const consultaDosLancamentos = (id: string, mes: string) =>
  queryOptions({
    queryKey: chavesProgramas.lancamentos(id, mes),
    queryFn: ({ signal }) =>
      api.get(`/sustentabilidade/programas/${id}/lancamentos`, {
        esquema: respostaLancamentos,
        consulta: { mes },
        sinal: signal,
      }),
  });

/** GET /sustentabilidade/parceiro/:token (sem login) */
export const consultaDoParceiro = (token: string) =>
  queryOptions({
    queryKey: chavesProgramas.parceiro(token),
    queryFn: ({ signal }) =>
      api.get(`/sustentabilidade/parceiro/${encodeURIComponent(token)}`, {
        esquema: respostaParceiro,
        sinal: signal,
      }),
    retry: false,
  });

// ---------------------------------------------------------------- cadastro

/** POST /programas (novo) ou PATCH /programas/:id (edição). */
export const salvarPrograma = (
  id: string | null,
  aoCriar?: (id: string) => void,
) =>
  acaoDaApi({
    metodo: id ? "PATCH" : "POST",
    caminho: id
      ? `/sustentabilidade/programas/${id}`
      : "/sustentabilidade/programas",
    invalida: [chavesProgramas.tudo],
    aoGravar: (r) => {
      const criado = respostaProgramaCriado.safeParse(r);
      if (!id && criado.success) aoCriar?.(criado.data.id);
    },
  });

/** PATCH /programas/:id/situacao: inativar ou reativar. */
export const alternarProgramaAtivo = acaoDaApi({
  metodo: "PATCH",
  caminho: (form) =>
    `/sustentabilidade/programas/${String(form.get("id"))}/situacao`,
  corpo: (form) => ({ ativo: form.get("ativo") === "true" }),
  invalida: [chavesProgramas.tudo],
});

/** POST /programas/:id/indicadores (novo) ou PATCH .../indicadores/:indicadorId. */
export const salvarIndicador = (programaId: string, indicadorId?: string) =>
  acaoDaApi({
    metodo: indicadorId ? "PATCH" : "POST",
    caminho: indicadorId
      ? `/sustentabilidade/programas/${programaId}/indicadores/${indicadorId}`
      : `/sustentabilidade/programas/${programaId}/indicadores`,
    invalida: [chavesProgramas.tudo],
  });

/** PATCH /indicadores/:id/situacao */
export const alternarIndicadorAtivo = acaoDaApi({
  metodo: "PATCH",
  caminho: (form) =>
    `/sustentabilidade/indicadores/${String(form.get("id"))}/situacao`,
  corpo: (form) => ({ ativo: form.get("ativo") === "true" }),
  invalida: [chavesProgramas.tudo],
});

// ---------------------------------------------------------------- link

export interface RespostaLink {
  ok?: string;
  erro?: string;
  /** O endereço, só na resposta de "Gerar" (não fica guardado). */
  link?: string;
}

/** POST /programas/:id/link */
export async function gerarLinkDoParceiro(
  programaId: string,
): Promise<RespostaLink> {
  try {
    const r = await api.post(
      `/sustentabilidade/programas/${programaId}/link`,
      undefined,
      { esquema: respostaLinkGerado },
    );
    await clienteDeConsultas.invalidateQueries({
      queryKey: chavesProgramas.links(programaId),
    });
    return { ok: r.mensagem, link: r.link };
  } catch (e) {
    return { erro: mensagemDe(e) };
  }
}

/** DELETE /programas/:id/link */
export async function desligarLinkDoParceiro(
  programaId: string,
): Promise<RespostaLink> {
  try {
    const r = await api.delete(
      `/sustentabilidade/programas/${programaId}/link`,
      { esquema: comMensagem },
    );
    await clienteDeConsultas.invalidateQueries({
      queryKey: chavesProgramas.links(programaId),
    });
    return { ok: r.mensagem };
  } catch (e) {
    return { erro: mensagemDe(e) };
  }
}

// ---------------------------------------------------------------- lançamentos

export interface RespostaLancamento {
  ok?: string;
  erro?: string;
  /** Erro por campo ({ campo_id: mensagem }). */
  erros?: Record<string, string>;
}

const mensagemDe = (e: unknown) => mensagemDoErro(e);

/** Converte a resposta da API no formato do formulário de lançamento. */
async function lancamento(
  pedido: () => Promise<RespostaMensagem>,
  depois: () => Promise<unknown> = invalidarLancamentos,
): Promise<RespostaLancamento> {
  try {
    const r = await pedido();
    await depois().catch(() => undefined);
    return { ok: r.mensagem };
  } catch (e) {
    return e instanceof ErroDaApi && e.campos
      ? { erro: e.mensagem, erros: e.campos }
      : { erro: mensagemDe(e) };
  }
}

/** POST /programas/:id/lancamentos: "Lançar pela equipe". */
export const lancarPelaEquipe = (
  programaId: string,
  p: { formularioId: string; versao: number } & EnvioDoFormulario,
) =>
  lancamento(() =>
    api.post(`/sustentabilidade/programas/${programaId}/lancamentos`, p, {
      esquema: comMensagem,
    }),
  );

/** PATCH /lancamentos/:id: corrigir. */
export const corrigirLancamento = (id: string, p: EnvioDoFormulario) =>
  lancamento(() =>
    api.patch(`/sustentabilidade/lancamentos/${id}`, p, {
      esquema: comMensagem,
    }),
  );

/** DELETE /lancamentos/:id */
export const excluirLancamento = (id: string) =>
  lancamento(() =>
    api.delete(`/sustentabilidade/lancamentos/${id}`, {
      esquema: comMensagem,
    }),
  );

export type DadosParaCorrigir = z.infer<typeof respostaCorrecao> & {
  erro?: string;
};

/** GET /lancamentos/:id/correcao: abre a correção. */
export async function abrirCorrecao(
  id: string,
): Promise<Partial<DadosParaCorrigir> & { erro?: string }> {
  try {
    return await api.get(`/sustentabilidade/lancamentos/${id}/correcao`, {
      esquema: respostaCorrecao,
    });
  } catch (e) {
    return { erro: mensagemDe(e) };
  }
}

// ---------------------------------------------------------------- formulários

/** GET /sustentabilidade/formularios?programa=<id> (aba Formulário). */
export const consultaDosFormulariosDoPrograma = (programaId: string) =>
  queryOptions({
    queryKey: [...chavesSustentabilidade.formularios(), "programa", programaId],
    queryFn: ({ signal }) =>
      api.get("/sustentabilidade/formularios", {
        esquema: respostaFormulariosDoPrograma,
        consulta: { programa: programaId },
        sinal: signal,
      }),
    select: (r) => r.formularios,
  });

/** As ações da lista respondem `{ ok }` ou `{ erro }` (como as antigas). */
async function acaoDoFormulario(
  pedido: () => Promise<RespostaFormulario>,
): Promise<RespostaFormulario> {
  try {
    const r = await pedido();
    if (!r.erro)
      await Promise.all([
        clienteDeConsultas.invalidateQueries({
          queryKey: chavesSustentabilidade.formularios(),
        }),
        clienteDeConsultas.invalidateQueries({
          queryKey: chavesProgramas.tudo,
        }),
      ]).catch(() => undefined);
    return r;
  } catch (e) {
    return { erro: mensagemDe(e) };
  }
}

const opcoesDoFormulario = { esquema: respostaFormulario };

export const criarFormularioDePrograma = (programaId: string, nome: string) =>
  acaoDoFormulario(() =>
    api.post(
      "/sustentabilidade/formularios",
      { programaId, nome },
      opcoesDoFormulario,
    ),
  );

export const renomearFormulario = (id: string, nome: string) =>
  acaoDoFormulario(() =>
    api.patch(
      `/sustentabilidade/formularios/${id}`,
      { nome },
      opcoesDoFormulario,
    ),
  );

export const alternarFormularioAtivo = (id: string, ativo: boolean) =>
  acaoDoFormulario(() =>
    api.patch(
      `/sustentabilidade/formularios/${id}`,
      { ativo },
      opcoesDoFormulario,
    ),
  );

export const duplicarFormulario = (id: string) =>
  acaoDoFormulario(() =>
    api.post(
      `/sustentabilidade/formularios/${id}/duplicar`,
      undefined,
      opcoesDoFormulario,
    ),
  );

export const excluirFormulario = (id: string) =>
  acaoDoFormulario(() =>
    api.delete(`/sustentabilidade/formularios/${id}`, opcoesDoFormulario),
  );

// ---------------------------------------------------------------- parceiro

/** POST /parceiro/:token/lancamentos */
export const lancarPeloLink = (
  token: string,
  p: { formularioId: string; versao: number } & EnvioDoFormulario,
) =>
  lancamento(
    () =>
      api.post(
        `/sustentabilidade/parceiro/${encodeURIComponent(token)}/lancamentos`,
        p,
        { esquema: comMensagem },
      ),
    () =>
      clienteDeConsultas.invalidateQueries({
        queryKey: chavesProgramas.parceiro(token),
      }),
  );

/** PATCH /parceiro/:token/lancamentos/:id */
export const corrigirPeloLink = (
  token: string,
  id: string,
  p: EnvioDoFormulario,
) =>
  lancamento(
    () =>
      api.patch(
        `/sustentabilidade/parceiro/${encodeURIComponent(token)}/lancamentos/${id}`,
        p,
        { esquema: comMensagem },
      ),
    () =>
      clienteDeConsultas.invalidateQueries({
        queryKey: chavesProgramas.parceiro(token),
      }),
  );
