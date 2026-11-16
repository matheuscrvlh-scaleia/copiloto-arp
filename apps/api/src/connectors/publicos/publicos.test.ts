import { describe, expect, it } from "vitest";
import {
  acumulado12Meses,
  acumular,
  buscarCep,
  buscarCnpj,
  buscarFeriados,
  buscarIndice,
} from "./index";

// Respostas montadas no formato de cada serviço (dados fictícios).

type Resposta = { status?: number; body: unknown };

function simular(rotas: Record<string, Resposta | Resposta[]>) {
  const chamadas: string[] = [];
  const fetch = (async (url: string | URL | Request) => {
    const u = String(url);
    chamadas.push(u);
    const chave = Object.keys(rotas).find((k) => u.includes(k));
    const r = chave ? rotas[chave] : undefined;
    const atual = Array.isArray(r) ? (r.shift() ?? r.at(-1)) : r;
    if (!atual) throw new Error("rede fora");
    return new Response(JSON.stringify(atual.body), {
      status: atual.status ?? 200,
    });
  }) as typeof globalThis.fetch;
  return { fetch, chamadas };
}

describe("CEP", () => {
  it("usa a BrasilAPI v2", async () => {
    const s = simular({
      "brasilapi.com.br/api/cep/v2/28610000": {
        body: {
          cep: "28610000",
          state: "RJ",
          city: "Nova Friburgo",
          neighborhood: "Centro",
          street: "Rua Exemplo",
          service: "open-cep",
        },
      },
    });
    expect(await buscarCep("28610000", s)).toEqual({
      cep: "28610000",
      logradouro: "Rua Exemplo",
      bairro: "Centro",
      cidade: "Nova Friburgo",
      uf: "RJ",
    });
  });

  it("cai para o ViaCEP quando a BrasilAPI falha", async () => {
    const s = simular({
      brasilapi: { status: 500, body: {} },
      "viacep.com.br/ws/28610000/json/": {
        body: {
          cep: "28610-000",
          logradouro: "Rua Exemplo",
          bairro: "Centro",
          localidade: "Nova Friburgo",
          uf: "RJ",
        },
      },
    });
    const r = await buscarCep("28610000", s);
    expect(r?.cidade).toBe("Nova Friburgo");
    expect(s.chamadas.filter((c) => c.includes("brasilapi"))).toHaveLength(2);
  }, 10_000);

  it("CEP que não existe é null (404 na BrasilAPI ou erro no ViaCEP)", async () => {
    expect(
      await buscarCep(
        "99999999",
        simular({ brasilapi: { status: 404, body: {} } }),
      ),
    ).toBeNull();
    const s = simular({
      brasilapi: { body: { formato: "outro" } },
      viacep: { body: { erro: "true" } },
    });
    expect(await buscarCep("99999999", s)).toBeNull();
  });

  it("recusa CEP sem 8 dígitos sem chamar ninguém", async () => {
    const s = simular({});
    await expect(buscarCep("2861", s)).rejects.toThrow();
    expect(s.chamadas).toHaveLength(0);
  });

  it("os dois fora do ar viram erro (quem chama devolve null)", async () => {
    const s = simular({
      brasilapi: { status: 503, body: {} },
      viacep: { status: 503, body: {} },
    });
    await expect(buscarCep("28610000", s)).rejects.toThrow();
  }, 10_000);
});

describe("CNPJ", () => {
  it("razão social, natureza, CNAE, capital, endereço e sócios", async () => {
    const s = simular({
      "cnpj/v1/11222333000181": {
        body: {
          cnpj: "11222333000181",
          razao_social: "EMPRESA EXEMPLO LTDA ",
          nome_fantasia: "Exemplo",
          natureza_juridica: "Sociedade Empresária Limitada",
          cnae_fiscal: 4781400,
          cnae_fiscal_descricao: "Comércio varejista de artigos do vestuário",
          capital_social: 50000,
          descricao_situacao_cadastral: "ATIVA",
          descricao_tipo_de_logradouro: "RUA",
          logradouro: "EXEMPLO",
          numero: "100",
          complemento: null,
          bairro: "CENTRO",
          municipio: "NOVA FRIBURGO",
          uf: "RJ",
          cep: "28610000",
          qsa: [
            {
              nome_socio: "SOCIA EXEMPLO",
              qualificacao_socio: "Sócio-Administrador",
            },
          ],
        },
      },
    });
    const r = await buscarCnpj("11222333000181", s);
    expect(r).toMatchObject({
      razaoSocial: "EMPRESA EXEMPLO LTDA",
      naturezaJuridica: "Sociedade Empresária Limitada",
      cnaePrincipal: "4781400 - Comércio varejista de artigos do vestuário",
      capitalSocial: 50000,
      endereco: { cep: "28610000", logradouro: "RUA EXEMPLO", complemento: "" },
      socios: [{ nome: "SOCIA EXEMPLO", qualificacao: "Sócio-Administrador" }],
    });
  });

  it("CNPJ que não existe é null; formato estranho é erro", async () => {
    expect(
      await buscarCnpj(
        "11222333000181",
        simular({ cnpj: { status: 404, body: {} } }),
      ),
    ).toBeNull();
    await expect(
      buscarCnpj("11222333000181", simular({ cnpj: { body: { x: 1 } } })),
    ).rejects.toThrow(/formato/);
  });
});

describe("feriados e índices", () => {
  it("feriados nacionais do ano", async () => {
    const s = simular({
      "feriados/v1/2026": {
        body: [
          {
            date: "2026-01-01",
            name: "Confraternização mundial",
            type: "national",
          },
          { date: "2026-04-21", name: "Tiradentes", type: "national" },
        ],
      },
    });
    expect(await buscarFeriados(2026, s)).toEqual([
      { data: "2026-01-01", nome: "Confraternização mundial" },
      { data: "2026-04-21", nome: "Tiradentes" },
    ]);
  });

  it("série do SGS em ordem, com o acumulado composto de 12 meses", async () => {
    const meses = Array.from({ length: 12 }, (_, i) => ({
      data: `01/${String(i + 1).padStart(2, "0")}/2025`,
      valor: i === 5 ? "-0.10" : "0.50",
    })).reverse();
    const s = simular({ "bcdata.sgs.189/dados/ultimos/12": { body: meses } });
    const r = await acumulado12Meses("IGPM", s);
    expect(r.ate).toBe("2025-12-01");
    expect(r.meses[0]?.competencia).toBe("2025-01-01");
    expect(r.acumulado12m).toBeCloseTo((1.005 ** 11 * 0.999 - 1) * 100, 3);
  });

  it("IPCA na série 433 e acumulado simples", async () => {
    const s = simular({
      "bcdata.sgs.433": { body: [{ data: "01/09/2026", valor: "0.44" }] },
    });
    expect(await buscarIndice("IPCA", 1, s)).toEqual([
      { competencia: "2026-09-01", variacao: 0.44 },
    ]);
    expect(
      acumular([
        { competencia: "x", variacao: 10 },
        { competencia: "y", variacao: 10 },
      ]),
    ).toBe(21);
  });

  it("série com menos de 12 meses é erro", async () => {
    const s = simular({
      "bcdata.sgs.433": { body: [{ data: "01/09/2026", valor: "0.44" }] },
    });
    await expect(acumulado12Meses("IPCA", s)).rejects.toThrow(/incompleta/);
  });
});
