import { describe, expect, it } from "vitest";
import { ConnectorError } from "../http";
import { createSecullumClient } from "./client";

type Handler = (url: string, init: RequestInit) => Response;

function fakeFetch(
  handler: Handler,
  calls: { url: string; init: RequestInit }[],
) {
  return (async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init);
  }) as typeof fetch;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("secullum", () => {
  it("autentica uma vez e envia token e banco em cada chamada", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const client = createSecullumClient({
      usuario: "rh@exemplo.com",
      senha: "x",
      bancoId: "123",
      fetch: fakeFetch(
        (url) =>
          url.endsWith("/Token")
            ? json({ access_token: "tok" })
            : json([{ Id: 9, Descricao: "Administração", Nfolha: "" }]),
        calls,
      ),
    });

    const deps = await client.departamentos();
    await client.departamentos();

    expect(deps[0]?.Descricao).toBe("Administração");
    expect(calls.filter((c) => c.url.endsWith("/Token"))).toHaveLength(1);
    const body = String(calls[0]?.init.body);
    expect(body).toContain("grant_type=password");
    expect(body).toContain("client_id=3");
    const headers = new Headers(calls[1]?.init.headers);
    expect(headers.get("authorization")).toBe("Bearer tok");
    expect(headers.get("secullumidbancoselecionado")).toBe("123");
  });

  it("renova o token uma vez quando recebe 401", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    let tokens = 0;
    let deps = 0;
    const client = createSecullumClient({
      usuario: "u",
      senha: "s",
      bancoId: "1",
      fetch: fakeFetch((url) => {
        if (url.endsWith("/Token"))
          return json({ access_token: `t${++tokens}` });
        return ++deps === 1 ? json({}, 401) : json([]);
      }, calls),
    });

    await expect(client.departamentos()).resolves.toEqual([]);
    expect(tokens).toBe(2);
  });

  it("recusa período de cálculo maior que um mês", async () => {
    const client = createSecullumClient({
      usuario: "u",
      senha: "s",
      bancoId: "1",
      fetch: fakeFetch(() => json({}), []),
    });
    await expect(
      client.calcular(
        { cpf: "000.000.000-00" },
        {
          inicio: "2026-07-01",
          fim: "2026-08-01",
        },
      ),
    ).rejects.toBeInstanceOf(ConnectorError);
  });

  it("tenta pelo PIS quando a API não acha o CPF", async () => {
    const corpos: string[] = [];
    const calculo = { Colunas: ["Carga"], Linhas: [], Totais: ["08:00"] };
    const client = createSecullumClient({
      usuario: "u",
      senha: "s",
      bancoId: "1",
      fetch: fakeFetch((url, init) => {
        if (url.endsWith("/Token")) return json({ access_token: "t" });
        const corpo = String(init.body);
        corpos.push(corpo);
        return corpo.includes("FuncionarioCpf")
          ? json(
              [
                {
                  Property: "FuncionarioCpf",
                  Message: "Funcionário não encontrado.",
                },
              ],
              400,
            )
          : json(calculo);
      }, []),
    });

    const r = await client.calcular(
      { cpf: "111", pis: "222" },
      { inicio: "2026-09-01", fim: "2026-09-30" },
    );
    expect(r).toEqual(calculo);
    expect(corpos).toHaveLength(2);
    expect(corpos[1]).toContain('"FuncionarioPis":"222"');
  });
});
