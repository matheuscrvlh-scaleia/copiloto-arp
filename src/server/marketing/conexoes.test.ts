import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { testarConexao } = await import("../integracoes");

// Teste de conexão por produto: um login (Meta) com página e Instagram; a
// página responde, o Instagram recusa o token.

afterEach(() => vi.unstubAllGlobals());

describe("teste de conexão com vários produtos", () => {
  it("testa cada produto preenchido e marca só o que falhou", async () => {
    vi.stubGlobal("fetch", (async (url: string | URL | Request) => {
      if (String(url).includes("/9?"))
        return new Response(
          JSON.stringify({ name: "Espaço ARP", followers_count: 1500 }),
        );
      return new Response(
        JSON.stringify({
          error: { message: "Invalid OAuth access token", code: 190 },
        }),
        { status: 401 },
      );
    }) as typeof fetch);

    const r = await testarConexao("mkt_meta", {
      parametros: { ad_account_id: "", page_id: "9", instagram_id: "8" },
      segredo: "tk",
    });

    expect(r.ok).toBe(false);
    expect(r.mensagem.split("\n")).toEqual([
      "✓ Facebook: “Espaço ARP” · 1.500 seguidores",
      "✗ Instagram: acesso recusado (HTTP 401): confira usuário, senha ou token (Invalid OAuth access token)",
    ]);
  });

  it("sem nenhum id, nem chega a chamar a API", async () => {
    const r = await testarConexao("mkt_meta", {
      parametros: { ad_account_id: "", page_id: "", instagram_id: "" },
      segredo: "tk",
    });
    expect(r).toEqual({
      ok: false,
      mensagem: "Falhou: campos incompletos ou inválidos",
    });
  });
});
