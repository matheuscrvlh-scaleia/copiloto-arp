import {
  ativoParaEditar,
  fichaDoAtivo,
  opcoesDoCadastro,
  respostaAtivoSalvo,
  respostaAtivos,
  respostaCategoriasDeAtivo,
  respostaEtiquetas,
  respostaSaidaRegistrada,
  respostaSaidas,
} from "@arp/shared/os/contratos/ativos";
import { type Planilha, planilha } from "@arp/shared/os/contratos/visoes";
import { rotaAtivo } from "@arp/shared/os/rotas";
import { queryOptions } from "@tanstack/react-query";
import type { Acao } from "@/components/form-acao";
import { acaoDaApi } from "@/lib/acao";
import { api, BASE_DA_API, type Consulta } from "@/lib/api";

// Chamadas dos Ativos do Tickets (prefixo /api/v1/os/ativos). As gravações
// têm o nome e a assinatura das Server Actions do sistema antigo
// (`@/server/os/acoes/ativos` e `saidas`). As chaves começam por "os": toda
// gravação do módulo atualiza as telas dos ativos também.

export const chavesAtivos = {
  tudo: ["os", "ativos"] as const,
  lista: (busca: Consulta) => ["os", "ativos", "lista", busca] as const,
  ficha: (id: string) => ["os", "ativos", "ficha", id] as const,
  opcoes: () => ["os", "ativos", "opcoes"] as const,
  edicao: (id: string) => ["os", "ativos", "edicao", id] as const,
  categorias: () => ["os", "ativos", "categorias"] as const,
  etiquetas: () => ["os", "ativos", "etiquetas"] as const,
  saidas: (busca: Consulta) => ["os", "ativos", "saidas", busca] as const,
};

const TUDO = [chavesAtivos.tudo];
const id = (form: FormData) => encodeURIComponent(String(form.get("id")));

// ---------------------------------------------------------------------------
// Leituras
// ---------------------------------------------------------------------------

/** GET /api/v1/os/ativos (lista ou decisão de troca, com os cartões). */
export const consultaDosAtivos = (busca: Consulta) =>
  queryOptions({
    queryKey: chavesAtivos.lista(busca),
    queryFn: ({ signal }) =>
      api.get("/os/ativos", {
        esquema: respostaAtivos,
        consulta: busca,
        sinal: signal,
      }),
  });

/** GET /api/v1/os/ativos/:id (a ficha). */
export const consultaDaFicha = (ativo: string) =>
  queryOptions({
    queryKey: chavesAtivos.ficha(ativo),
    queryFn: ({ signal }) =>
      api.get(`/os/ativos/${encodeURIComponent(ativo)}`, {
        esquema: fichaDoAtivo,
        sinal: signal,
      }),
  });

/** GET /api/v1/os/ativos/opcoes (listas do cadastro). */
export const consultaDasOpcoes = queryOptions({
  queryKey: chavesAtivos.opcoes(),
  queryFn: ({ signal }) =>
    api.get("/os/ativos/opcoes", { esquema: opcoesDoCadastro, sinal: signal }),
});

/** GET /api/v1/os/ativos/:id/edicao */
export const consultaDaEdicao = (ativo: string) =>
  queryOptions({
    queryKey: chavesAtivos.edicao(ativo),
    queryFn: ({ signal }) =>
      api.get(`/os/ativos/${encodeURIComponent(ativo)}/edicao`, {
        esquema: ativoParaEditar,
        sinal: signal,
      }),
  });

/** GET /api/v1/os/ativos/categorias */
export const consultaDasCategorias = queryOptions({
  queryKey: chavesAtivos.categorias(),
  queryFn: ({ signal }) =>
    api.get("/os/ativos/categorias", {
      esquema: respostaCategoriasDeAtivo,
      sinal: signal,
    }),
});

/** GET /api/v1/os/ativos/etiquetas */
export const consultaDasEtiquetas = queryOptions({
  queryKey: chavesAtivos.etiquetas(),
  queryFn: ({ signal }) =>
    api.get("/os/ativos/etiquetas", {
      esquema: respostaEtiquetas,
      sinal: signal,
    }),
});

/** GET /api/v1/os/ativos/saidas (o relatório). */
export const consultaDasSaidas = (busca: Consulta) =>
  queryOptions({
    queryKey: chavesAtivos.saidas(busca),
    queryFn: ({ signal }) =>
      api.get("/os/ativos/saidas", {
        esquema: respostaSaidas,
        consulta: busca,
        sinal: signal,
      }),
  });

/** Exportar: o filtro inteiro, lido só no clique. */
export function exportarAtivos(
  busca: Record<string, string>,
): Promise<Planilha> {
  return api.get("/os/ativos/exportacao", {
    esquema: planilha,
    consulta: busca,
  });
}

/** PDF das etiquetas de um ou poucos ativos (link direto, GET). */
export function hrefDasEtiquetas(ids: string[], inicio?: number): string {
  const p = new URLSearchParams();
  for (const i of ids) p.append("id", i);
  if (inicio) p.set("inicio", String(inicio));
  return `${BASE_DA_API}/os/ativos/etiquetas/pdf?${p}`;
}

/** PDF das etiquetas em lote (POST; pode passar de mil ativos). */
export async function pdfDasEtiquetas(
  ids: string[],
  inicio: number,
): Promise<Blob> {
  const { blob } = await api.baixar("/os/ativos/etiquetas/pdf", {
    metodo: "POST",
    corpo: { ids, inicio },
  });
  return blob;
}

/** Recibo da saída em PDF. */
export const hrefDoRecibo = (saida: string) =>
  `${BASE_DA_API}/os/ativos/saidas/${encodeURIComponent(saida)}/recibo`;

// ---------------------------------------------------------------------------
// Gravações
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/os/ativos (multipart, com a foto); depois abre a ficha, como
 * o `redirect` de antes.
 */
export const salvarAtivo = (abrir: (href: string) => void): Acao =>
  acaoDaApi({
    metodo: "POST",
    caminho: "/os/ativos",
    corpo: (form) => form,
    invalida: TUDO,
    mensagem: "",
    aoGravar: (resposta, form) => {
      const r = respostaAtivoSalvo.parse(resposta);
      abrir(
        `${rotaAtivo(r.id)}${form.get("id") ? "?salvo=1" : "?criado=1"}${r.semFoto ? "&foto=0" : ""}`,
      );
    },
  });

/** POST /api/v1/os/ativos/:id/situacao */
export const mudarSituacao: Acao = acaoDaApi({
  metodo: "POST",
  caminho: (form) => `/os/ativos/${id(form)}/situacao`,
  invalida: TUDO,
});

/** POST /api/v1/os/ativos/:id/baixa */
export const darBaixa: Acao = acaoDaApi({
  metodo: "POST",
  caminho: (form) => `/os/ativos/${id(form)}/baixa`,
  invalida: TUDO,
});

/** POST /api/v1/os/ativos/:ativo_id/anexos (multipart) */
export const enviarAnexo: Acao = acaoDaApi({
  metodo: "POST",
  caminho: (form) =>
    `/os/ativos/${encodeURIComponent(String(form.get("ativo_id")))}/anexos`,
  corpo: (form) => form,
  invalida: TUDO,
});

/** DELETE /api/v1/os/ativos/anexos/:id */
export const removerAnexo: Acao = acaoDaApi({
  metodo: "DELETE",
  caminho: (form) => `/os/ativos/anexos/${id(form)}`,
  invalida: TUDO,
});

/** POST /api/v1/os/ativos/planos (cria ou salva) */
export const salvarPlano: Acao = acaoDaApi({
  metodo: "POST",
  caminho: "/os/ativos/planos",
  invalida: TUDO,
});

/** POST /api/v1/os/ativos/planos/:id/alternar */
export const alternarPlano: Acao = acaoDaApi({
  metodo: "POST",
  caminho: (form) => `/os/ativos/planos/${id(form)}/alternar`,
  invalida: TUDO,
});

/** DELETE /api/v1/os/ativos/planos/:id */
export const excluirPlano: Acao = acaoDaApi({
  metodo: "DELETE",
  caminho: (form) => `/os/ativos/planos/${id(form)}`,
  invalida: TUDO,
});

/** POST /api/v1/os/ativos/planos/:id/gerar */
export const gerarPreventivaAgora: Acao = acaoDaApi({
  metodo: "POST",
  caminho: (form) => `/os/ativos/planos/${id(form)}/gerar`,
  corpo: () => ({}),
  invalida: [["os"]],
});

/** POST /api/v1/os/ativos/categorias (cria ou salva) */
export const salvarCategoria: Acao = acaoDaApi({
  metodo: "POST",
  caminho: "/os/ativos/categorias",
  invalida: TUDO,
});

/** DELETE /api/v1/os/ativos/categorias/:id */
export const excluirCategoria: Acao = acaoDaApi({
  metodo: "DELETE",
  caminho: (form) => `/os/ativos/categorias/${id(form)}`,
  invalida: TUDO,
});

/**
 * POST /api/v1/os/ativos/saidas (multipart, com os anexos). A sobra sem
 * cadastro vira um ativo baixado: abre a ficha dele (o `redirect` de antes).
 */
export const registrarSaida = (abrir: (href: string) => void): Acao =>
  acaoDaApi({
    metodo: "POST",
    caminho: "/os/ativos/saidas",
    corpo: (form) => form,
    invalida: TUDO,
    aoGravar: (resposta) => {
      const r = respostaSaidaRegistrada.parse(resposta);
      if (r.ativoId) abrir(`${rotaAtivo(r.ativoId)}?saida=1`);
    },
  });

/** POST /api/v1/os/ativos/saidas/:id/desfazer */
export const desfazerSaida: Acao = acaoDaApi({
  metodo: "POST",
  caminho: (form) => `/os/ativos/saidas/${id(form)}/desfazer`,
  invalida: TUDO,
});
