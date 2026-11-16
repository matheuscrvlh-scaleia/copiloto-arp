import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ConnectorError, mensagemSegura, parseWith, requestJson } from "./http";

function sequence(...responses: (() => Response)[]) {
  let i = 0;
  const f = (async () => {
    const next = responses[Math.min(i, responses.length - 1)];
    i++;
    if (!next) throw new Error("sem resposta");
    return next();
  }) as typeof fetch;
  return { fetch: f, count: () => i };
}

describe("requestJson", () => {
  it("tenta de novo em 429 respeitando Retry-After", async () => {
    const s = sequence(
      () => new Response("", { status: 429, headers: { "retry-after": "0" } }),
      () => new Response('{"ok":true}', { status: 200 }),
    );
    await expect(
      requestJson("teste", "https://x.test", { fetch: s.fetch }),
    ).resolves.toEqual({ ok: true });
    expect(s.count()).toBe(2);
  });

  it("não tenta de novo em 400 e devolve o corpo no erro", async () => {
    const s = sequence(() => new Response("campo inválido", { status: 400 }));
    const err = await requestJson("teste", "https://x.test", {
      fetch: s.fetch,
    }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ConnectorError);
    expect((err as ConnectorError).status).toBe(400);
    expect((err as ConnectorError).detalhe).toBe("campo inválido");
    expect(s.count()).toBe(1);
  });
});

describe("parseWith", () => {
  it("transforma formato inesperado em ConnectorError", () => {
    expect(() =>
      parseWith("teste", z.object({ a: z.number() }), { a: "1" }),
    ).toThrow(ConnectorError);
  });
});

describe("mensagemSegura", () => {
  it("traz a mensagem da API e esconde documentos", () => {
    const erro = new ConnectorError(
      "HTTP 400",
      "secullum",
      400,
      '[{"Property":"FuncionarioCpf","Message":"Funcionário 123.456.789-09 não encontrado."}]',
    );
    expect(mensagemSegura(erro)).toBe(
      "[secullum] HTTP 400: Funcionário <documento> não encontrado.",
    );
  });
});

describe("repetirEm429", () => {
  it("false: falha no primeiro 429, sem gastar mais cota", async () => {
    const s = sequence(() => new Response("", { status: 429 }));
    const err = await requestJson("teste", "https://x.test", {
      fetch: s.fetch,
      repetirEm429: false,
    }).then(
      () => null,
      (e: unknown) => e,
    );
    expect((err as ConnectorError).status).toBe(429);
    expect(s.count()).toBe(1);
  });
});
