import { describe, expect, it } from "vitest";
import entrada from "./__fixtures__/entrada.json";
import pagamentoDetalhe from "./__fixtures__/pagamento-detalhe.json";
import { createWpsClient, pagamentosUnicos } from "./client";
import { pagamentosDoDiaSchema } from "./schemas";

function fakeFetch(body: unknown, calls: string[] = []) {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push(String(url));
    expect(new Headers(init?.headers).get("authorization")).toMatch(/^Basic /);
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
}

const config = {
  baseUrl: "https://wps.test/",
  usuario: "u",
  senha: "s",
  estacionamentoId: 1,
};

describe("wps", () => {
  it("monta a rota com o dia em yyyymmdd e detalhe=true", async () => {
    const calls: string[] = [];
    const client = createWpsClient({
      ...config,
      fetch: fakeFetch(pagamentoDetalhe, calls),
    });
    await client.pagamentos(new Date(2026, 0, 15));
    expect(calls[0]).toBe(
      "https://wps.test/servicos/operacional/estacionamento/1/20260115/pagamento?detalhe=true",
    );
  });

  it("valida entradas por tipo de veículo", async () => {
    const client = createWpsClient({ ...config, fetch: fakeFetch(entrada) });
    const r = await client.entradas(new Date(2026, 8, 23));
    expect(r.subdetalhes.carro?.quantidade).toBe(r.quantidade);
  });

  it("não conta o mesmo pagamento duas vezes", () => {
    const dia = pagamentosDoDiaSchema.parse(pagamentoDetalhe);
    // A API diz 7, mas são 3 pagamentos: um repetido em `desconto` e
    // registros repetidos por RPS dentro de `cartao_credito`.
    expect(dia.quantidade).toBe(7);
    const unicos = pagamentosUnicos(dia);
    expect(unicos.map((p) => p.codigo).sort()).toEqual([41337, 41338, 41339]);
    expect(unicos.reduce((s, p) => s + p.valorLiquido, 0)).toBe(328);
  });
});
