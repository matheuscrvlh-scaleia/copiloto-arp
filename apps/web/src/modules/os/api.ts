import {
  type CategoriaDoFormulario,
  dadosDoFormulario,
  horariosDoDia as esquemaHorarios,
  opcoesDeVinculo as esquemaVinculos,
  type HorariosDoDia,
  inicialDoFormulario,
  type OpcoesDeVinculo,
  respostaApoio,
  respostaCategoriaRapida,
  respostaMensagem,
} from "@arp/shared/os/contratos/base";
import {
  detalheChamado,
  respostaContatos,
  respostaCriacao,
} from "@arp/shared/os/contratos/chamados";
import { respostaDisparos } from "@arp/shared/os/contratos/disparos";
import {
  type Planilha,
  planilha,
  respostaCalendario,
  respostaLista,
  respostaQuadro,
  respostaSeuDia,
} from "@arp/shared/os/contratos/visoes";
import type { Busca, Tela, TelaComLista } from "@arp/shared/os/lista";
import { queryOptions } from "@tanstack/react-query";
import type { Acao, EstadoAcao } from "@/components/form-acao";
import { acaoDaApi, formParaObjeto } from "@/lib/acao";
import { api, type Consulta, ErroDaApi, mensagemDoErro } from "@/lib/api";
import { clienteDeConsultas, VALIDADE } from "@/lib/consulta";

// Chamadas da base e dos chamados do Tickets (prefixo /api/v1/os). As
// gravações têm o mesmo nome e a mesma assinatura das Server Actions do
// sistema antigo (`@/server/os/acoes/*`): os componentes só trocaram o
// import. Toda gravação invalida as consultas do módulo (o `refresh()` de
// antes).

export type {
  HorariosDoDia,
  OpcoesDeVinculo,
} from "@arp/shared/os/contratos/base";

/** Chaves de consulta do módulo: sempre começam por "os". */
export const chavesOs = {
  tudo: ["os"] as const,
  /** Configuração (setores, catálogo, pessoas): muda pouco. */
  apoio: () => ["os", "apoio"] as const,
  formulario: () => ["os", "formulario"] as const,
  inicial: (busca: Consulta) => ["os", "formulario", "inicial", busca] as const,
  chamado: (id: string) => ["os", "chamado", id] as const,
  contatos: () => ["os", "contatos"] as const,
  lista: (tela: TelaComLista, busca: Consulta) =>
    ["os", "visoes", "lista", tela, busca] as const,
  quadro: (ordens: boolean, busca: Consulta) =>
    ["os", "visoes", "quadro", ordens, busca] as const,
  calendario: (busca: Consulta) =>
    ["os", "visoes", "calendario", busca] as const,
  seuDia: () => ["os", "visoes", "seu-dia"] as const,
  disparos: () => ["os", "disparos"] as const,
};

/** Parâmetros da URL da tela → consulta da API (como vieram). */
export function consultaDaBusca(busca: Busca): Consulta {
  const c: Consulta = {};
  for (const [k, v] of Object.entries(busca)) {
    if (typeof v === "string") c[k] = v;
    else if (Array.isArray(v))
      c[k] = v.filter((x): x is string => typeof x === "string");
  }
  return c;
}

// ---------------------------------------------------------------------------
// Leituras
// ---------------------------------------------------------------------------

/** GET /api/v1/os/apoio */
export const consultaDoApoio = queryOptions({
  queryKey: chavesOs.apoio(),
  queryFn: ({ signal }) =>
    api.get("/os/apoio", { esquema: respostaApoio, sinal: signal }),
  staleTime: VALIDADE.configuracao,
});

/** GET /api/v1/os/formulario */
export const consultaDoFormulario = queryOptions({
  queryKey: chavesOs.formulario(),
  queryFn: ({ signal }) =>
    api.get("/os/formulario", { esquema: dadosDoFormulario, sinal: signal }),
  staleTime: VALIDADE.configuracao,
});

/** GET /api/v1/os/formulario/inicial (`os`: a página de abrir OS). */
export const consultaDoInicial = (busca: Busca, os = false) => {
  const consulta = { ...consultaDaBusca(busca), os: os ? "1" : "0" };
  return queryOptions({
    queryKey: chavesOs.inicial(consulta),
    queryFn: ({ signal }) =>
      api.get("/os/formulario/inicial", {
        esquema: inicialDoFormulario,
        consulta,
        sinal: signal,
      }),
  });
};

/**
 * GET /api/v1/os/chamados/:id (chamado ou OS). `null`: não existe ou a
 * pessoa não tem acesso (a tela mostra o aviso, como antes).
 */
export const consultaDoChamado = (id: string) =>
  queryOptions({
    queryKey: chavesOs.chamado(id),
    queryFn: ({ signal }) =>
      api
        .get(`/os/chamados/${encodeURIComponent(id)}`, {
          esquema: detalheChamado,
          sinal: signal,
        })
        .catch((erro: unknown) => {
          if (erro instanceof ErroDaApi && erro.status === 404) return null;
          throw erro;
        }),
  });

/** GET /api/v1/os/contatos */
export const consultaDosContatos = queryOptions({
  queryKey: chavesOs.contatos(),
  queryFn: ({ signal }) =>
    api.get("/os/contatos", { esquema: respostaContatos, sinal: signal }),
  select: (r) => r.contatos,
  staleTime: VALIDADE.configuracao,
});

/** GET /api/v1/os/visoes/lista */
export const consultaDaLista = (tela: TelaComLista, busca: Busca) => {
  const consulta = consultaDaBusca(busca);
  return queryOptions({
    queryKey: chavesOs.lista(tela, consulta),
    queryFn: ({ signal }) =>
      api.get("/os/visoes/lista", {
        esquema: respostaLista,
        consulta: { ...consulta, tela },
        sinal: signal,
      }),
  });
};

/** GET /api/v1/os/visoes/quadro */
export const consultaDoQuadro = (busca: Busca, ordens = false) => {
  const consulta = consultaDaBusca(busca);
  return queryOptions({
    queryKey: chavesOs.quadro(ordens, consulta),
    queryFn: ({ signal }) =>
      api.get("/os/visoes/quadro", {
        esquema: respostaQuadro,
        consulta: { ...consulta, ordens: ordens ? "1" : "0" },
        sinal: signal,
      }),
  });
};

/** GET /api/v1/os/visoes/calendario */
export const consultaDoCalendario = (busca: Busca) => {
  const consulta = consultaDaBusca(busca);
  return queryOptions({
    queryKey: chavesOs.calendario(consulta),
    queryFn: ({ signal }) =>
      api.get("/os/visoes/calendario", {
        esquema: respostaCalendario,
        consulta,
        sinal: signal,
      }),
  });
};

/** GET /api/v1/os/visoes/seu-dia */
export const consultaDoSeuDia = queryOptions({
  queryKey: chavesOs.seuDia(),
  queryFn: ({ signal }) =>
    api.get("/os/visoes/seu-dia", { esquema: respostaSeuDia, sinal: signal }),
  select: (r) => r.resumo,
});

/** GET /api/v1/os/disparos */
export const consultaDosDisparos = queryOptions({
  queryKey: chavesOs.disparos(),
  queryFn: ({ signal }) =>
    api.get("/os/disparos", { esquema: respostaDisparos, sinal: signal }),
});

/** GET /api/v1/os/formulario/vinculos: lojas e ativos de "Mais detalhes". */
export function opcoesDeVinculo(): Promise<OpcoesDeVinculo> {
  return api.get("/os/formulario/vinculos", { esquema: esquemaVinculos });
}

/** GET /api/v1/os/agendas/:id/horarios: horários livres num dia. */
export function horariosDoDia(
  agendaId: string,
  data: string,
): Promise<HorariosDoDia> {
  return api.get(`/os/agendas/${encodeURIComponent(agendaId)}/horarios`, {
    esquema: esquemaHorarios,
    consulta: { data },
  });
}

/** GET /api/v1/os/visoes/lista/exportacao: o resultado filtrado inteiro. */
export function exportarLista(
  tela: string,
  busca: Record<string, string>,
): Promise<Planilha> {
  return api.get("/os/visoes/lista/exportacao", {
    esquema: planilha,
    consulta: { ...busca, tela },
  });
}

/** GET /api/v1/os/visoes/quadro/exportacao: todas as colunas, inteiras. */
export function exportarQuadro(
  busca: Record<string, string>,
  ordens = false,
): Promise<Planilha> {
  return api.get("/os/visoes/quadro/exportacao", {
    esquema: planilha,
    consulta: { ...busca, ordens: ordens ? "1" : "0" },
  });
}

// ---------------------------------------------------------------------------
// Gravações
// ---------------------------------------------------------------------------

/** Tudo o que as telas do módulo leem (o `refresh()` de antes). */
const TUDO = [chavesOs.tudo];

/** Depois de gravar por código: as telas abertas buscam de novo. */
export function atualizarOs(): Promise<void> {
  return clienteDeConsultas
    .invalidateQueries({ queryKey: chavesOs.tudo })
    .catch(() => {});
}

const idDe = (form: FormData) => encodeURIComponent(String(form.get("id")));

/** O formulário sem o `id` (que vai no endereço). */
const semId = (form: FormData) => {
  const { id: _id, ...resto } = formParaObjeto(form);
  return resto;
};

/** Gravação chamada por código: `{ ok }` com a mensagem ou `{ erro }`. */
async function gravar(
  pedido: () => Promise<{ mensagem: string }>,
): Promise<EstadoAcao> {
  try {
    const { mensagem } = await pedido();
    await atualizarOs();
    return mensagem ? { ok: mensagem } : {};
  } catch (erro) {
    return { erro: mensagemDoErro(erro) };
  }
}

const comMensagem = { esquema: respostaMensagem };

export interface EstadoCriacao extends EstadoAcao {
  id?: string;
  numero?: number;
  /** Abriu, mas algo opcional falhou (horário, arquivo). */
  aviso?: string;
}

/** POST /api/v1/os/chamados (multipart): abre o chamado ou a OS. */
export async function abrirChamado(
  _: EstadoCriacao,
  form: FormData,
): Promise<EstadoCriacao> {
  try {
    const r = await api.post("/os/chamados", form, {
      esquema: respostaCriacao,
    });
    await atualizarOs();
    return { ok: r.mensagem, id: r.id, numero: r.numero, aviso: r.aviso };
  } catch (erro) {
    return { erro: mensagemDoErro(erro) };
  }
}

/** POST /api/v1/os/chamados/:id/acoes */
export const agir: Acao = acaoDaApi({
  metodo: "POST",
  caminho: (form) => `/os/chamados/${idDe(form)}/acoes`,
  corpo: semId,
  invalida: TUDO,
});

/** PATCH /api/v1/os/chamados/:id */
export const alterarChamado: Acao = acaoDaApi({
  metodo: "PATCH",
  caminho: (form) => `/os/chamados/${idDe(form)}`,
  corpo: semId,
  invalida: TUDO,
});

/** Ações que antes devolviam `{}`: sem aviso de sucesso. */
const calada = (opcoes: Parameters<typeof acaoDaApi>[0]): Acao => {
  const acao = acaoDaApi(opcoes);
  return async (anterior, form) => {
    const r = await acao(anterior, form);
    return r.erro ? r : {};
  };
};

/** POST /api/v1/os/chamados/:id/checklist */
export const marcarChecklist: Acao = calada({
  metodo: "POST",
  caminho: (form) => `/os/chamados/${idDe(form)}/checklist`,
  corpo: semId,
  invalida: TUDO,
});

/** POST /api/v1/os/chamados/:id/comentarios (multipart) */
export const comentar: Acao = acaoDaApi({
  metodo: "POST",
  caminho: (form) => `/os/chamados/${idDe(form)}/comentarios`,
  corpo: (form) => form,
  invalida: TUDO,
});

/** POST /api/v1/os/chamados/:id/seguir */
export const seguirChamado: Acao = acaoDaApi({
  metodo: "POST",
  caminho: (form) => `/os/chamados/${idDe(form)}/seguir`,
  corpo: semId,
  invalida: TUDO,
});

/** POST /api/v1/os/chamados/:id/leitura */
export const marcarLido: Acao = acaoDaApi({
  metodo: "POST",
  caminho: (form) => `/os/chamados/${idDe(form)}/leitura`,
  corpo: () => undefined,
  invalida: TUDO,
});

/** POST /api/v1/os/destinos/:id/mover */
export const moverDestino: Acao = calada({
  metodo: "POST",
  caminho: (form) => `/os/destinos/${idDe(form)}/mover`,
  corpo: semId,
  invalida: TUDO,
});

/** POST /api/v1/os/destinos/:id/andar */
export const andarDestino: Acao = calada({
  metodo: "POST",
  caminho: (form) => `/os/destinos/${idDe(form)}/andar`,
  corpo: semId,
  invalida: TUDO,
});

/** PATCH /api/v1/os/destinos/:id */
export const definirTarefaDestino: Acao = calada({
  metodo: "PATCH",
  caminho: (form) => `/os/destinos/${idDe(form)}`,
  corpo: semId,
  invalida: TUDO,
});

/** POST /api/v1/os/chamados/lote/responsavel (null: volta para a fila). */
export function atribuirResponsavel(
  lista: string[],
  responsavel: string | null,
): Promise<EstadoAcao> {
  return gravar(() =>
    api.post(
      "/os/chamados/lote/responsavel",
      { ids: lista, responsavel },
      comMensagem,
    ),
  );
}

/** POST /api/v1/os/chamados/lote/prazo ("aaaa-mm-ddTHH:MM"; null tira). */
export function mudarPrazo(
  lista: string[],
  prazo: string | null,
): Promise<EstadoAcao> {
  return gravar(() =>
    api.post("/os/chamados/lote/prazo", { ids: lista, prazo }, comMensagem),
  );
}

/** POST /api/v1/os/chamados/lote/prioridade */
export function mudarPrioridade(
  lista: string[],
  prioridade: string,
): Promise<EstadoAcao> {
  return gravar(() =>
    api.post(
      "/os/chamados/lote/prioridade",
      { ids: lista, prioridade },
      comMensagem,
    ),
  );
}

/** POST /api/v1/os/chamados/:id/confirmar */
export function confirmarChamado(chamado: string): Promise<EstadoAcao> {
  return gravar(() =>
    api.post(
      `/os/chamados/${encodeURIComponent(chamado)}/confirmar`,
      undefined,
      comMensagem,
    ),
  );
}

/** POST /api/v1/os/chamados/:id/reabrir */
export function reabrirChamado(
  chamado: string,
  motivo: string,
): Promise<EstadoAcao> {
  return gravar(() =>
    api.post(
      `/os/chamados/${encodeURIComponent(chamado)}/reabrir`,
      { motivo },
      comMensagem,
    ),
  );
}

/**
 * POST /api/v1/os/chamados/:id/mover: cartão solto noutra coluna do quadro.
 * As telas buscam de novo mesmo no erro (um passo pode ter sido gravado).
 */
export async function moverChamado(entrada: {
  chamado: string;
  para: string;
  aguardandoTipo?: string;
  motivo?: string;
}): Promise<EstadoAcao> {
  const { chamado, ...corpo } = entrada;
  const r = await gravar(() =>
    api.post(
      `/os/chamados/${encodeURIComponent(chamado)}/mover`,
      corpo,
      comMensagem,
    ),
  );
  if (r.erro) await atualizarOs();
  return r;
}

/** PUT /api/v1/os/preferencias/filtros/:tela: lembra os filtros da tela. */
export async function lembrarFiltros(
  qual: Tela,
  valores: Record<string, string>,
): Promise<void> {
  await api
    .put(`/os/preferencias/filtros/${qual}`, { valores })
    .catch(() => {});
  // O que ficou guardado de outras URLs foi lido com os filtros lembrados
  // de antes: na próxima visita, busca de novo.
  clienteDeConsultas.removeQueries({
    queryKey: ["os", "visoes"],
    type: "inactive",
  });
}

/** POST /api/v1/os/preferencias/seu-dia: não aparece de novo até amanhã. */
export async function marcarSeuDiaVisto(): Promise<void> {
  await api.post("/os/preferencias/seu-dia").catch(() => {});
  clienteDeConsultas.setQueryData(chavesOs.seuDia(), { resumo: null });
}

/** POST /api/v1/os/categorias/rapida: categoria criada no "Novo chamado". */
export async function criarCategoriaRapida(dados: {
  nome: string;
  setorId: string;
  icone: string;
  tipo: string;
}): Promise<{ erro: string } | { categoria: CategoriaDoFormulario }> {
  try {
    const r = await api.post("/os/categorias/rapida", dados, {
      esquema: respostaCategoriaRapida,
    });
    await atualizarOs();
    return r;
  } catch (erro) {
    return { erro: mensagemDoErro(erro) };
  }
}

/** POST /api/v1/os/terceirizados/rapido */
export function criarTerceirizadoRapido(
  dados: Partial<
    Record<
      "nome" | "cnpj" | "contato" | "telefone" | "email" | "servicos",
      string
    >
  >,
): Promise<EstadoAcao> {
  return gravar(() => api.post("/os/terceirizados/rapido", dados, comMensagem));
}

/** POST /api/v1/os/disparos: "Disparar modelo" à mão. */
export const dispararModeloManual: Acao = acaoDaApi({
  metodo: "POST",
  caminho: "/os/disparos",
  invalida: TUDO,
});

/** POST /api/v1/os/series/:id/parar */
export const pararSerie: Acao = acaoDaApi({
  metodo: "POST",
  caminho: (form) =>
    `/os/series/${encodeURIComponent(String(form.get("serie_id")))}/parar`,
  corpo: (form) => ({ ultima_id: form.get("ultima_id") }),
  invalida: TUDO,
});
