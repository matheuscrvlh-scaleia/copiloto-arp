import { describe, expect, it } from "vitest";
import {
  custoEmDolar,
  formatarTokens,
  lerGrafico,
  limiteEfetivo,
  motivoDoBloqueio,
  somarUso,
  tituloDaConversa,
  tokensQueContam,
  USO_ZERADO,
} from "./regras";

const PRECO = { entrada: 4, saida: 20, cache_escrita: 5, cache_leitura: 0.2 };

describe("uso e custo", () => {
  const uso = {
    entrada: 1000,
    saida: 500,
    cache_escrita: 2000,
    cache_leitura: 10_000,
  };

  it("soma por tipo", () => {
    expect(somarUso(uso, uso)).toEqual({
      entrada: 2000,
      saida: 1000,
      cache_escrita: 4000,
      cache_leitura: 20_000,
    });
    expect(somarUso(USO_ZERADO, uso)).toEqual(uso);
  });

  it("releitura do cache não conta no limite", () => {
    expect(tokensQueContam(uso)).toBe(3500);
  });

  it("custo por milhão de tokens de cada tipo", () => {
    // 1000×4 + 500×20 + 2000×5 + 10000×0,2 = 26.000 / 1e6
    expect(custoEmDolar(uso, PRECO)).toBeCloseTo(0.026, 6);
    expect(custoEmDolar(uso, undefined)).toBe(0);
  });
});

describe("limite efetivo", () => {
  it("pessoa vence cargo, que vence o padrão", () => {
    expect(limiteEfetivo({ usuario: 10, cargo: 20, padrao: 30 })).toBe(10);
    expect(limiteEfetivo({ usuario: undefined, cargo: 20, padrao: 30 })).toBe(
      20,
    );
    expect(
      limiteEfetivo({ usuario: undefined, cargo: undefined, padrao: 30 }),
    ).toBe(30);
  });

  it("null em um nível é 'sem limite', não 'cai para o próximo'", () => {
    expect(limiteEfetivo({ usuario: null, cargo: 20, padrao: 30 })).toBeNull();
  });
});

describe("bloqueio", () => {
  const base = {
    ativa: true,
    configurada: true,
    usadosMes: 0,
    limiteMes: null,
    gastoMesUsd: 0,
    orcamentoMesUsd: null,
  };

  it("livre quando ligada, configurada e dentro dos tetos", () => {
    expect(motivoDoBloqueio(base)).toBeNull();
  });

  it("explica cada barreira", () => {
    expect(motivoDoBloqueio({ ...base, ativa: false })).toMatch(/desligada/);
    expect(motivoDoBloqueio({ ...base, configurada: false })).toMatch(
      /configurada/,
    );
    expect(
      motivoDoBloqueio({ ...base, usadosMes: 100, limiteMes: 100 }),
    ).toMatch(/seu limite/);
    expect(
      motivoDoBloqueio({ ...base, gastoMesUsd: 50, orcamentoMesUsd: 50 }),
    ).toMatch(/teto de gasto/);
  });
});

describe("textos", () => {
  it("título curto numa linha", () => {
    expect(tituloDaConversa("  Quanto  de\nCO₂ evitamos? ")).toBe(
      "Quanto de CO₂ evitamos?",
    );
    expect(tituloDaConversa("a".repeat(100))).toHaveLength(68);
  });

  it("tokens legíveis", () => {
    expect(formatarTokens(950)).toBe("950");
    expect(formatarTokens(12_300)).toBe("12 mil");
    expect(formatarTokens(4_500_000)).toBe("4,5 mi");
  });
});

describe("gráfico da resposta", () => {
  it("lê o JSON do bloco e recusa o que não serve", () => {
    expect(
      lerGrafico(
        '{"tipo":"colunas","titulo":"Leads","itens":[{"rotulo":"out","valor":3}]}',
      ),
    ).toEqual({
      tipo: "colunas",
      titulo: "Leads",
      unidade: "numero",
      itens: [{ rotulo: "out", valor: 3 }],
    });
    expect(lerGrafico("{")).toBeNull();
    expect(lerGrafico('{"tipo":"pizza","titulo":"x","itens":[]}')).toBeNull();
  });
});
