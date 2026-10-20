import { describe, expect, it } from "vitest";
import { createDiarioDeObrasClient } from "./client";

const EMPRESA = {
  _id: "57fa4eebffd18769058b4567",
  nome: "Construtora Exemplo",
  razaoSocial: "CONSTRUTORA EXEMPLO LTDA",
  log: { totalObras: 8, totalUsuarios: 6 },
};

describe("diário de obras", () => {
  it("manda o token no header e valida a empresa", async () => {
    const chamadas: { url: string; token: string | null }[] = [];
    const client = createDiarioDeObrasClient({
      token: "abc",
      fetch: (async (url: string | URL | Request, init?: RequestInit) => {
        chamadas.push({
          url: String(url),
          token: new Headers(init?.headers).get("token"),
        });
        return new Response(JSON.stringify(EMPRESA), { status: 200 });
      }) as typeof fetch,
    });
    const e = await client.empresa();
    expect(chamadas).toEqual([
      { url: "https://apiexterna.diariodeobra.app/v1/empresa", token: "abc" },
    ]);
    expect(e).toEqual({
      _id: EMPRESA._id,
      nome: EMPRESA.nome,
      log: { totalObras: 8 },
    });
  });

  it("token recusado vira erro do conector", async () => {
    const client = createDiarioDeObrasClient({
      token: "errado",
      fetch: (async () =>
        new Response('{"erro":"token inválido"}', {
          status: 401,
        })) as typeof fetch,
    });
    await expect(client.empresa()).rejects.toThrow(/HTTP 401/);
  });
});
