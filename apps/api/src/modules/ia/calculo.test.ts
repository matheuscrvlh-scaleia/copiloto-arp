import { describe, expect, it } from "vitest";
import { calcular } from "./calculo";

// Dados fictícios no formato das fontes de anúncios e do RD.
const anuncios = {
  meta: {
    insights: [
      { campaign_id: "1", date_start: "2026-10-31", spend: 100 },
      { campaign_id: "1", date_start: "2026-11-01", spend: 40.5 },
      { campaign_id: "2", date_start: "2026-11-17", spend: 59.5 },
    ],
  },
  google: {
    linhas: [
      {
        segments: { date: "2026-11-02" },
        metrics: { cost_micros: 25_000_000 },
      },
      { segments: { date: "2026-12-01" }, metrics: { cost_micros: 9_000_000 } },
    ],
  },
};
const rd = {
  conversoes: [
    { created_at: "2026-11-01T03:00:00Z", traffic_campaign: "A" },
    { created_at: "2026-11-17T23:59:00Z", traffic_campaign: "A" },
    { created_at: "2026-11-10T12:00:00Z", traffic_campaign: null },
    { created_at: "2026-10-30T12:00:00Z", traffic_campaign: "B" },
  ],
};
const NOV = ["2026-11-01", "2026-11-30"];

describe("calcular", () => {
  it("soma no período (as duas pontas entram)", () => {
    const r = calcular(anuncios, {
      lista: "meta.insights",
      filtros: [{ campo: "date_start", op: "entre", valor: NOV }],
      medidas: [{ funcao: "soma", campo: "spend" }],
    });
    expect(r.itens_na_lista).toBe(3);
    expect(r.itens_no_filtro).toBe(2);
    expect(r.grupos).toEqual([{ "soma(spend)": 100 }]);
  });

  it("campo dentro de objeto e fator (micros → reais)", () => {
    const r = calcular(anuncios, {
      lista: "google.linhas",
      filtros: [{ campo: "segments.date", op: "entre", valor: NOV }],
      medidas: [
        {
          funcao: "soma",
          campo: "metrics.cost_micros",
          multiplicar: 0.000001,
          nome: "gasto",
        },
      ],
    });
    expect(r.grupos).toEqual([{ gasto: 25 }]);
  });

  it("instante ISO comparado pelo dia; agrupa e conta", () => {
    const r = calcular(rd, {
      lista: "conversoes",
      filtros: [{ campo: "created_at", op: "entre", valor: NOV }],
      agrupar_por: ["traffic_campaign"],
      medidas: [{ funcao: "contagem" }],
      ordenar_por: "contagem",
      decrescente: true,
    });
    expect(r.grupos).toEqual([
      { traffic_campaign: "A", contagem: 2 },
      { traffic_campaign: "(vazio)", contagem: 1 },
    ]);
  });

  it("agrupa por mês e filtra preenchido, em e contem", () => {
    const porMes = calcular(rd, {
      lista: "conversoes",
      filtros: [{ campo: "traffic_campaign", op: "preenchido" }],
      agrupar_por: ["created_at:mes"],
      medidas: [{ funcao: "contagem" }],
    });
    expect(porMes.grupos).toEqual([
      { "created_at:mes": "2026-10", contagem: 1 },
      { "created_at:mes": "2026-11", contagem: 2 },
    ]);
    const em = calcular(rd, {
      lista: "conversoes",
      filtros: [{ campo: "traffic_campaign", op: "em", valor: ["B", "C"] }],
      medidas: [{ funcao: "contagem" }],
    });
    expect(em.grupos[0]?.contagem).toBe(1);
    const contem = calcular(rd, {
      lista: "conversoes",
      filtros: [{ campo: "traffic_campaign", op: "contem", valor: "a" }],
      medidas: [{ funcao: "distintos", campo: "traffic_campaign" }],
    });
    expect(contem.grupos[0]?.["distintos(traffic_campaign)"]).toBe(1);
  });

  it("média, mínimo e máximo; lista inexistente avisa", () => {
    const r = calcular(anuncios, {
      lista: "meta.insights",
      medidas: [
        { funcao: "media", campo: "spend" },
        { funcao: "minimo", campo: "spend" },
        { funcao: "maximo", campo: "spend" },
      ],
    });
    expect(r.grupos[0]).toEqual({
      "media(spend)": 66.666667,
      "minimo(spend)": 40.5,
      "maximo(spend)": 100,
    });
    const nada = calcular(anuncios, {
      lista: "nao.existe",
      medidas: [{ funcao: "contagem" }],
    });
    expect(nada.aviso).toMatch(/vazia/);
    expect(nada.grupos).toEqual([{ contagem: 0 }]);
  });

  it("a própria resposta como lista e limite de grupos", () => {
    const r = calcular([{ x: 1 }, { x: 2 }, { x: 3 }], {
      lista: "",
      agrupar_por: ["x"],
      medidas: [{ funcao: "contagem" }],
      limite: 2,
    });
    expect(r.grupos).toHaveLength(2);
    expect(r.grupos_no_total).toBe(3);
  });
});
