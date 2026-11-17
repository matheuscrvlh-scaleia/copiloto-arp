import {
  respostaClube,
  respostaContribuicoes,
  respostaLinkDoTermo,
  respostaParticipante,
  respostaParticipanteCriado,
} from "@arp/shared/sustentabilidade/contratos/clube";
import { queryOptions } from "@tanstack/react-query";
import type { Acao } from "@/components/form-acao";
import { acaoDaApi } from "@/lib/acao";
import { api, mensagemDoErro } from "@/lib/api";
import { clienteDeConsultas } from "@/lib/consulta";

// Clube SustentArp na tela (spec 4.5): a lista do ano, o detalhe do
// participante, as contribuições e as gravações (as antigas actions de
// acoes/clube.ts, com os mesmos nomes). As chaves começam por
// "sustentabilidade"; toda gravação invalida o clube inteiro.

export const chavesClube = {
  tudo: ["sustentabilidade", "clube"] as const,
  lista: (ano: string) => ["sustentabilidade", "clube", "lista", ano] as const,
  participante: (id: string) =>
    ["sustentabilidade", "clube", "participante", id] as const,
  contribuicoes: (f: Record<string, string>) =>
    ["sustentabilidade", "clube", "contribuicoes", f] as const,
};

const invalida = [chavesClube.tudo];

/** Como o `campo()` das actions: texto do formulário, "" se faltar. */
const campos = (form: FormData, nomes: string[]) =>
  Object.fromEntries(
    nomes.map((n) => {
      const v = form.get(n);
      return [n, typeof v === "string" ? v : ""];
    }),
  );

const formas = (form: FormData) => form.getAll("forma").map(String);

// ---------------------------------------------------------------- leituras

/** GET /sustentabilidade/clube?ano= ("" = o ano corrente) */
export const consultaDoClube = (ano: string) =>
  queryOptions({
    queryKey: chavesClube.lista(ano),
    queryFn: ({ signal }) =>
      api.get("/sustentabilidade/clube", {
        esquema: respostaClube,
        consulta: { ano },
        sinal: signal,
      }),
  });

/** GET /sustentabilidade/clube/participantes/:id */
export const consultaDoParticipante = (id: string) =>
  queryOptions({
    queryKey: chavesClube.participante(id),
    queryFn: ({ signal }) =>
      api.get(`/sustentabilidade/clube/participantes/${id}`, {
        esquema: respostaParticipante,
        sinal: signal,
      }),
    retry: false,
  });

/** GET /sustentabilidade/clube/contribuicoes?de&ate&participante&forma */
export const consultaDasContribuicoes = (f: {
  de: string;
  ate: string;
  participante: string;
  forma: string;
}) =>
  queryOptions({
    queryKey: chavesClube.contribuicoes(f),
    queryFn: ({ signal }) =>
      api.get("/sustentabilidade/clube/contribuicoes", {
        esquema: respostaContribuicoes,
        consulta: f,
        sinal: signal,
      }),
  });

// ---------------------------------------------------------------- participante

/** Cria e abre o participante (antes: redirect para o detalhe). */
export const criarParticipante =
  (abrir: (id: string) => void): Acao =>
  async (_anterior, form) => {
    try {
      const r = await api.post(
        "/sustentabilidade/clube/participantes",
        {
          ...campos(form, [
            "origem",
            "cliente_doc",
            "nome",
            "documento",
            "email",
            "telefone",
            "contato",
          ]),
          formas: formas(form),
        },
        { esquema: respostaParticipanteCriado },
      );
      await clienteDeConsultas
        .invalidateQueries({ queryKey: chavesClube.tudo })
        .catch(() => {});
      abrir(r.id);
      return {};
    } catch (e) {
      return { erro: mensagemDoErro(e) };
    }
  };

export const salvarDadosDoParticipante = acaoDaApi({
  metodo: "POST",
  caminho: "/sustentabilidade/clube/participantes/dados",
  corpo: (form) => ({
    ...campos(form, ["participante_id"]),
    formas: formas(form),
    ...(form.has("nome") ? campos(form, ["nome"]) : {}),
  }),
  invalida,
});

export const salvarContato = acaoDaApi({
  metodo: "POST",
  caminho: "/sustentabilidade/clube/participantes/contato",
  corpo: (form) =>
    campos(form, ["participante_id", "email", "telefone", "contato"]),
  invalida,
});

export const salvarValorCombinado = acaoDaApi({
  metodo: "POST",
  caminho: "/sustentabilidade/clube/participantes/valor",
  corpo: (form) => campos(form, ["participante_id", "valor"]),
  invalida,
});

export const registrarSaida = acaoDaApi({
  metodo: "POST",
  caminho: "/sustentabilidade/clube/participantes/saida",
  corpo: (form) => campos(form, ["participante_id", "saiu_em", "motivo"]),
  invalida,
});

export const reativarParticipante = acaoDaApi({
  metodo: "POST",
  caminho: "/sustentabilidade/clube/participantes/reativar",
  corpo: (form) => campos(form, ["participante_id"]),
  invalida,
});

// ---------------------------------------------------------------- termos

/** Multipart: participante_id, ano, assinado_em e o PDF (arquivo). */
export const registrarTermoAnexo = acaoDaApi({
  metodo: "POST",
  caminho: "/sustentabilidade/clube/termos",
  corpo: (form) => form,
  invalida,
});

/** Multipart: os dados do termo, nome, documento e a PNG (assinatura). */
export const registrarTermoAssinado = acaoDaApi({
  metodo: "POST",
  caminho: "/sustentabilidade/clube/termos/assinado",
  corpo: (form) => form,
  invalida,
});

export const removerTermo = acaoDaApi({
  metodo: "DELETE",
  caminho: (form) => `/sustentabilidade/clube/termos/${idDo(form)}`,
  invalida,
});

/** Link de leitura (60 s) do PDF ou da assinatura do termo. */
export async function linkDoTermo(
  termoId: string,
  qual: "arquivo" | "assinatura",
): Promise<{ url: string } | { erro: string }> {
  try {
    return await api.get(`/sustentabilidade/clube/termos/${termoId}/link`, {
      esquema: respostaLinkDoTermo,
      consulta: { qual },
    });
  } catch (e) {
    return { erro: mensagemDoErro(e) };
  }
}

// ---------------------------------------------------------------- contribuições e ações

/** Id do registro no formulário (campo "id"); vazio vira "-" (a API recusa). */
const idDo = (form: FormData) =>
  encodeURIComponent(String(form.get("id") ?? "") || "-");

export const registrarContribuicao = acaoDaApi({
  metodo: "POST",
  caminho: "/sustentabilidade/clube/contribuicoes",
  corpo: (form) =>
    campos(form, [
      "participante_id",
      "data",
      "forma",
      "competencia",
      "valor",
      "observacao",
    ]),
  invalida,
});

export const removerContribuicao = acaoDaApi({
  metodo: "DELETE",
  caminho: (form) => `/sustentabilidade/clube/contribuicoes/${idDo(form)}`,
  invalida,
});

export const registrarAcao = acaoDaApi({
  metodo: "POST",
  caminho: "/sustentabilidade/clube/acoes",
  corpo: (form) =>
    campos(form, ["participante_id", "data", "tipo", "observacao"]),
  invalida,
});

export const removerAcao = acaoDaApi({
  metodo: "DELETE",
  caminho: (form) => `/sustentabilidade/clube/acoes/${idDo(form)}`,
  invalida,
});
