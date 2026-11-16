import { vi } from "vitest";

// API de mentira para os testes: troca o `fetch` global por respostas
// combinadas por "MÉTODO /caminho" (o caminho como a tela pede, com /api/v1).

export interface Pedido {
  metodo: string;
  caminho: string;
  headers: Headers;
  corpo: BodyInit | null | undefined;
}

type Responder = (pedido: Pedido) => Response | Promise<Response>;

/** Resposta JSON. */
export function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Resposta de erro no formato da API. */
export function erro(
  status: number,
  codigo: string,
  mensagem = "Erro de teste.",
  campos?: Record<string, string>,
): Response {
  return json({ erro: { codigo, mensagem, campos } }, status);
}

/**
 * Liga a API falsa. `rotas`: "GET /api/v1/auth/eu" → resposta (ou função).
 * Pedido sem rota combinada responde 404. Devolve a lista dos pedidos feitos.
 */
export function apiFalsa(rotas: Record<string, Response | Responder>) {
  const pedidos: Pedido[] = [];
  const falso = vi.fn(
    async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(entrada), "http://teste.local");
      const pedido: Pedido = {
        metodo: init?.method ?? "GET",
        caminho: url.pathname + url.search,
        headers: new Headers(init?.headers),
        corpo: init?.body,
      };
      pedidos.push(pedido);
      const rota =
        rotas[`${pedido.metodo} ${pedido.caminho}`] ??
        rotas[`${pedido.metodo} ${url.pathname}`];
      if (!rota) return erro(404, "nao_encontrado", "Rota de teste ausente.");
      // Cada pedido lê o corpo da própria resposta.
      return typeof rota === "function" ? rota(pedido) : rota.clone();
    },
  );
  vi.stubGlobal("fetch", falso);
  return {
    pedidos,
    /** Quantos pedidos foram feitos para "MÉTODO /caminho". */
    quantos: (chave: string) =>
      pedidos.filter((p) => `${p.metodo} ${p.caminho}` === chave).length,
  };
}

/** Resposta de GET /auth/eu para os testes. */
export function euDeTeste(permissoes: string[] = [], senhaProvisoria = false) {
  return {
    usuario: {
      id: "7b0c8f0e-6f5e-4d3a-9c1b-2a4e6f8d0c11",
      nome: "Pessoa de Teste",
      email: "pessoa@exemplo.test",
      permissoes,
    },
    senha_provisoria: senhaProvisoria,
    sessao: {
      inicio: "2026-01-05T12:00:00.000Z",
      expira_em: "2026-01-05T20:00:00.000Z",
      inatividade_em: "2026-01-05T12:30:00.000Z",
      acesso_expira_em: "2026-01-05T12:10:00.000Z",
    },
  };
}
