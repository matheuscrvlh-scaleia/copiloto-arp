import { respostaMensagem } from "@arp/shared/os/contratos/base";
import {
  type LojaDaEntrada,
  planilhaDoPortal,
  respostaAgenda,
  respostaAgendas,
  respostaEntrar,
  respostaGravacao,
  respostaInicioDoPortal,
  respostaLinks,
  respostaLoja,
  respostaLojas,
  respostaNovoPedido,
  respostaPedidoCriado,
  respostaPedidoDoPortal,
} from "@arp/shared/os/contratos/portal";
import type { Planilha } from "@arp/shared/os/contratos/visoes";
import { queryOptions } from "@tanstack/react-query";
import type { Acao, EstadoAcao } from "@/components/form-acao";
import { acaoDaApi, formParaObjeto } from "@/lib/acao";
import { api, type Consulta, mensagemDoErro } from "@/lib/api";
import { clienteDeConsultas } from "@/lib/consulta";

// Chamadas do Portal lojista: a tela interna (/api/v1/os/portal) e o portal
// público da loja (/api/v1/os/portal-publico). As gravações têm o nome e a
// assinatura das Server Actions do sistema antigo
// (`@/server/os/acoes/portal` e `portal-publico`).

export const chavesPortal = {
  /** Tela interna (dentro de "os": as gravações do módulo também renovam). */
  tudo: ["os", "portal"] as const,
  links: (busca: Consulta) => ["os", "portal", "links", busca] as const,
  lojas: (busca: Consulta) => ["os", "portal", "lojas", busca] as const,
  loja: (id: string) => ["os", "portal", "loja", id] as const,
  agendas: () => ["os", "portal", "agendas"] as const,
  agenda: (id: string) => ["os", "portal", "agenda", id] as const,
  /** Portal público: o que a loja vê (outra sessão, outras chaves). */
  publico: ["portal-publico"] as const,
  inicio: () => ["portal-publico", "inicio"] as const,
  novo: (categoria: string) => ["portal-publico", "novo", categoria] as const,
  pedido: (id: string) => ["portal-publico", "pedido", id] as const,
};

const TUDO = [chavesPortal.tudo];

// ---------------------------------------------------------------------------
// Tela interna: leituras
// ---------------------------------------------------------------------------

/** GET /api/v1/os/portal/links */
export const consultaDosLinks = (busca: Consulta) =>
  queryOptions({
    queryKey: chavesPortal.links(busca),
    queryFn: ({ signal }) =>
      api.get("/os/portal/links", {
        esquema: respostaLinks,
        consulta: busca,
        sinal: signal,
      }),
  });

/** GET /api/v1/os/portal/lojas */
export const consultaDasLojas = (busca: Consulta) =>
  queryOptions({
    queryKey: chavesPortal.lojas(busca),
    queryFn: ({ signal }) =>
      api.get("/os/portal/lojas", {
        esquema: respostaLojas,
        consulta: busca,
        sinal: signal,
      }),
  });

/** GET /api/v1/os/portal/lojas/:id */
export const consultaDaLoja = (id: string) =>
  queryOptions({
    queryKey: chavesPortal.loja(id),
    queryFn: ({ signal }) =>
      api.get(`/os/portal/lojas/${encodeURIComponent(id)}`, {
        esquema: respostaLoja,
        sinal: signal,
      }),
    select: (r) => r.loja,
  });

/** GET /api/v1/os/portal/agendas */
export const consultaDasAgendas = queryOptions({
  queryKey: chavesPortal.agendas(),
  queryFn: ({ signal }) =>
    api.get("/os/portal/agendas", { esquema: respostaAgendas, sinal: signal }),
});

/** GET /api/v1/os/portal/agendas/:id */
export const consultaDaAgenda = (id: string) =>
  queryOptions({
    queryKey: chavesPortal.agenda(id),
    queryFn: ({ signal }) =>
      api.get(`/os/portal/agendas/${encodeURIComponent(id)}`, {
        esquema: respostaAgenda,
        sinal: signal,
      }),
    select: (r) => r.agenda,
  });

/** GET /api/v1/os/portal/links/exportacao: o filtro inteiro, no clique. */
export function exportarLinks(
  busca: Record<string, string>,
): Promise<Planilha> {
  return api.get("/os/portal/links/exportacao", {
    esquema: planilhaDoPortal,
    consulta: busca,
  });
}

/** GET /api/v1/os/portal/lojas/exportacao: o filtro inteiro, no clique. */
export function exportarLojas(
  busca: Record<string, string>,
): Promise<Planilha> {
  return api.get("/os/portal/lojas/exportacao", {
    esquema: planilhaDoPortal,
    consulta: busca,
  });
}

// ---------------------------------------------------------------------------
// Tela interna: gravações
// ---------------------------------------------------------------------------

/** POST /api/v1/os/portal/acessos/encerrar */
export const encerrarAcesso = acaoDaApi({
  metodo: "POST",
  caminho: "/os/portal/acessos/encerrar",
  invalida: TUDO,
});

const foiCriado = (resposta: unknown) =>
  respostaGravacao.safeParse(resposta).data?.criado === true;

/**
 * POST /api/v1/os/portal/lojas. `aoCriar`: a loja nova volta para a lista
 * (o `redirect` de antes).
 */
export const salvarLoja = (aoCriar: () => void): Acao =>
  acaoDaApi({
    metodo: "POST",
    caminho: "/os/portal/lojas",
    invalida: [chavesPortal.tudo, ["os", "formulario"]],
    aoGravar: (resposta) => {
      if (foiCriado(resposta)) aoCriar();
    },
  });

/** POST /api/v1/os/portal/agendas */
export const salvarAgenda = (aoCriar: () => void): Acao =>
  acaoDaApi({
    metodo: "POST",
    caminho: "/os/portal/agendas",
    corpo: (form) => formParaObjeto(form, { listas: ["dias_semana"] }),
    invalida: [["os"]],
    aoGravar: (resposta) => {
      if (foiCriado(resposta)) aoCriar();
    },
  });

/** POST /api/v1/os/portal/bloqueios */
export const bloquearAgenda = acaoDaApi({
  metodo: "POST",
  caminho: "/os/portal/bloqueios",
  invalida: [["os"]],
});

/** DELETE /api/v1/os/portal/bloqueios/:id */
export const removerBloqueio = acaoDaApi({
  metodo: "DELETE",
  caminho: (form) =>
    `/os/portal/bloqueios/${encodeURIComponent(String(form.get("id")))}`,
  invalida: [["os"]],
});

const doAgendamento = (form: FormData, acao: string) =>
  `/os/portal/agendamentos/${encodeURIComponent(String(form.get("agendamento")))}/${acao}`;

/** POST /api/v1/os/portal/agendamentos/:id/remarcacao */
export const remarcarAgendamento = acaoDaApi({
  metodo: "POST",
  caminho: (form) => doAgendamento(form, "remarcacao"),
  corpo: (form) => ({ horario: String(form.get("horario") ?? "") }),
  invalida: [["os"]],
});

/** POST /api/v1/os/portal/agendamentos/:id/cancelamento */
export const cancelarAgendamento = acaoDaApi({
  metodo: "POST",
  caminho: (form) => doAgendamento(form, "cancelamento"),
  corpo: () => ({}),
  invalida: [["os"]],
});

// ---------------------------------------------------------------------------
// Portal público (a loja, sem login do sistema)
// ---------------------------------------------------------------------------

/**
 * A sessão do portal é só da loja: uma recusa aqui nunca tenta renovar a
 * sessão de usuário nem leva à tela de login do sistema.
 */
const DA_LOJA = { renovar: false, irParaOLogin: false } as const;

const PUBLICO = "/os/portal-publico";

/** GET /api/v1/os/portal-publico/inicio (`loja: null`: mostrar a entrada). */
export const consultaDoInicioDoPortal = queryOptions({
  queryKey: chavesPortal.inicio(),
  queryFn: ({ signal }) =>
    api.get(`${PUBLICO}/inicio`, {
      ...DA_LOJA,
      esquema: respostaInicioDoPortal,
      sinal: signal,
    }),
  staleTime: 0,
});

/** GET /api/v1/os/portal-publico/categorias/:id */
export const consultaDoNovoPedido = (categoria: string) =>
  queryOptions({
    queryKey: chavesPortal.novo(categoria),
    queryFn: ({ signal }) =>
      api.get(`${PUBLICO}/categorias/${encodeURIComponent(categoria)}`, {
        ...DA_LOJA,
        esquema: respostaNovoPedido,
        sinal: signal,
      }),
    staleTime: 0,
  });

/** GET /api/v1/os/portal-publico/pedidos/:id */
export const consultaDoPedidoDoPortal = (id: string) =>
  queryOptions({
    queryKey: chavesPortal.pedido(id),
    queryFn: ({ signal }) =>
      api.get(`${PUBLICO}/pedidos/${encodeURIComponent(id)}`, {
        ...DA_LOJA,
        esquema: respostaPedidoDoPortal,
        sinal: signal,
      }),
    staleTime: 0,
  });

/** As telas do portal buscam de novo (o `refresh()` de antes). */
async function atualizarPortal(): Promise<void> {
  await clienteDeConsultas
    .invalidateQueries({ queryKey: chavesPortal.publico })
    .catch(() => {});
}

export interface EstadoEntrada extends EstadoAcao {
  /** Mais de uma loja vigente no CNPJ: a pessoa escolhe. */
  lojas?: LojaDaEntrada[];
  /** O que foi digitado (o formulário volta preenchido). */
  cnpj?: string;
}

/** POST /api/v1/os/portal-publico/entrar */
export async function entrar(
  _: EstadoEntrada,
  form: FormData,
): Promise<EstadoEntrada> {
  const cnpj = String(form.get("cnpj") ?? "").slice(0, 18);
  try {
    const r = await api.post(
      `${PUBLICO}/entrar`,
      { cnpj, loja: String(form.get("loja") ?? "") },
      { ...DA_LOJA, esquema: respostaEntrar },
    );
    if (!r.entrou) return { lojas: r.lojas ?? [], cnpj };
    await atualizarPortal();
    return {};
  } catch (erro) {
    return { erro: mensagemDoErro(erro), cnpj };
  }
}

/** POST /api/v1/os/portal-publico/sair ("Trocar de loja"). */
export async function sair(): Promise<void> {
  await api.post(`${PUBLICO}/sair`, undefined, DA_LOJA).catch(() => {});
  // Nada do que a loja via fica guardado na tela.
  clienteDeConsultas.removeQueries({ queryKey: chavesPortal.publico });
  await atualizarPortal();
}

export interface EstadoPedido extends EstadoAcao {
  id?: string;
  numero?: number;
  aviso?: string;
}

/** POST /api/v1/os/portal-publico/pedidos (multipart: fotos e anexos). */
export async function enviarPedido(
  _: EstadoPedido,
  form: FormData,
): Promise<EstadoPedido> {
  try {
    const r = await api.post(`${PUBLICO}/pedidos`, form, {
      ...DA_LOJA,
      esquema: respostaPedidoCriado,
    });
    await atualizarPortal();
    return { ok: r.mensagem, id: r.id, numero: r.numero, aviso: r.aviso };
  } catch (erro) {
    return { erro: mensagemDoErro(erro) };
  }
}

const doPedido = (form: FormData, acao: string) =>
  `${PUBLICO}/pedidos/${encodeURIComponent(String(form.get("pedido")))}/${acao}`;

/** Ação de um pedido: `corpo` FormData (arquivos) ou objeto (JSON). */
const acaoDoPedido =
  (acao: string, corpo: (form: FormData) => unknown) =>
  async (_: EstadoAcao, form: FormData): Promise<EstadoAcao> => {
    try {
      const r = await api.post(doPedido(form, acao), corpo(form), {
        ...DA_LOJA,
        esquema: respostaMensagem,
      });
      await atualizarPortal();
      return { ok: r.mensagem };
    } catch (erro) {
      return { erro: mensagemDoErro(erro) };
    }
  };

const semOPedido = (form: FormData) => {
  const { pedido: _, ...resto } = formParaObjeto(form);
  return resto;
};

/** POST /api/v1/os/portal-publico/pedidos/:id/respostas (multipart). */
export const responder = acaoDoPedido("respostas", (form) => form);

/** POST /api/v1/os/portal-publico/pedidos/:id/avaliacao */
export const avaliar = acaoDoPedido("avaliacao", semOPedido);

/** POST /api/v1/os/portal-publico/pedidos/:id/reabertura */
export const reabrir = acaoDoPedido("reabertura", semOPedido);

/** POST /api/v1/os/portal-publico/pedidos/:id/remarcacao */
export const remarcar = acaoDoPedido("remarcacao", semOPedido);
