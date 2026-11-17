import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ConnectorError } from "../http";
import { createClaudeClient } from "./client";

// Respostas no formato da API da Anthropic (valores fictícios).

interface Chamada {
  url: string;
  corpo: Record<string, unknown> | null;
  headers: Headers;
}

function fakeFetch(status: number, corpo: unknown, chamadas: Chamada[] = []) {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    chamadas.push({
      url: String(url),
      corpo: typeof init?.body === "string" ? JSON.parse(init.body) : null,
      headers: new Headers(init?.headers),
    });
    return new Response(JSON.stringify(corpo), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

const mensagem = (texto: string, stop_reason = "end_turn") => ({
  id: "msg_1",
  type: "message",
  role: "assistant",
  model: "claude-opus-5-5",
  content: [{ type: "text", text: texto }],
  stop_reason,
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 5 },
});

const pedido = { instrucoes: "Resuma.", conteudo: "Texto longo." };

describe("claude", () => {
  it("devolve o texto e manda instruções com cache e o fallback", async () => {
    const chamadas: Chamada[] = [];
    const api = createClaudeClient({
      apiKey: "sk-teste",
      modelo: "claude-opus-5-5",
      fetch: fakeFetch(200, mensagem(" Resumo. "), chamadas),
    });
    expect(await api.texto({ ...pedido, esforco: "low" })).toBe("Resumo.");
    const c = chamadas[0];
    expect(c?.headers.get("authorization")).toBe("Bearer sk-teste");
    expect(c?.headers.get("anthropic-beta")).toContain("server-side-fallback");
    expect(c?.corpo).toMatchObject({
      model: "claude-opus-5-5",
      fallbacks: "default",
      output_config: { effort: "low" },
      system: [{ text: "Resuma.", cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: "Texto longo." }],
    });
  });

  it("modelo sem fallback vai sem o parâmetro", async () => {
    const chamadas: Chamada[] = [];
    const api = createClaudeClient({
      apiKey: "sk-teste",
      modelo: "claude-haiku-4-5",
      fetch: fakeFetch(200, mensagem("ok"), chamadas),
    });
    await api.texto(pedido);
    expect(chamadas[0]?.corpo).not.toHaveProperty("fallbacks");
  });

  it("json: valida a resposta pelo schema da tela", async () => {
    const schema = z.object({ titulo: z.string(), nota: z.number() });
    const api = createClaudeClient({
      apiKey: "sk-teste",
      modelo: "claude-opus-5-5",
      fetch: fakeFetch(200, mensagem('{"titulo":"A","nota":7}')),
    });
    expect(await api.json({ ...pedido, schema })).toEqual({
      titulo: "A",
      nota: 7,
    });
  });

  it("recusa e resposta cortada viram erro", async () => {
    for (const [stop, texto] of [
      ["refusal", "recusou"],
      ["max_tokens", "tamanho máximo"],
    ] as const) {
      const api = createClaudeClient({
        apiKey: "sk-teste",
        modelo: "claude-opus-5-5",
        fetch: fakeFetch(200, mensagem("", stop)),
      });
      await expect(api.texto(pedido)).rejects.toThrow(texto);
    }
  });

  it("chave recusada vira ConnectorError 401 sem a chave", async () => {
    const api = createClaudeClient({
      apiKey: "sk-secreta",
      modelo: "claude-opus-5-5",
      fetch: fakeFetch(401, {
        type: "error",
        error: { type: "authentication_error", message: "invalid x-api-key" },
      }),
    });
    const erro = await api.verificar().catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ConnectorError);
    expect(erro).toMatchObject({ status: 401 });
    expect(JSON.stringify(erro)).not.toContain("sk-secreta");
    expect((erro as ConnectorError).detalhe).toContain("invalid x-api-key");
  });

  it("verificar lê o modelo", async () => {
    const chamadas: Chamada[] = [];
    const api = createClaudeClient({
      apiKey: "sk-teste",
      modelo: "claude-opus-5-5",
      fetch: fakeFetch(
        200,
        {
          type: "model",
          id: "claude-opus-5-5",
          display_name: "Claude Opus 5.5",
          created_at: "2026-01-01T00:00:00Z",
        },
        chamadas,
      ),
    });
    expect(await api.verificar()).toEqual({
      id: "claude-opus-5-5",
      nome: "Claude Opus 5.5",
    });
    expect(chamadas[0]?.url).toContain("/v1/models/claude-opus-5-5");
  });
});
