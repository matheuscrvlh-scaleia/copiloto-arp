import { describe, expect, it } from "vitest";
import {
  centavosDe,
  compararRevisoes,
  curvaS,
  type EtapaPrevista,
  indicadoresDaObra,
  type Limites,
  linhasPorEtapa,
  mesesEntre,
  numeroDoMes,
  proximaRevisao,
  rotuloMes,
  situacaoDoOrcamento,
  somarMeses,
} from "./obras";

const LIMITES: Limites = { desvioPontos: -10, orcamentoPct: 10 };
const v = (mes: string, centavos: number) => ({ mes, centavos });

describe("meses e centavos", () => {
  it("centavos pelo mais próximo, meio centavo para longe do zero", () => {
    expect(centavosDe(165555.12)).toBe(16_555_512);
    expect(centavosDe(0.005)).toBe(1);
    expect(centavosDe(-0.005)).toBe(-1);
    expect(centavosDe(110271.414)).toBe(11_027_141);
  });

  it("soma meses atravessando o ano e lista o intervalo", () => {
    expect(somarMeses("2026-12-01", 1)).toBe("2027-01-01");
    expect(somarMeses("2027-01-01", -1)).toBe("2026-12-01");
    expect(somarMeses("2026-07-01", 18)).toBe("2028-01-01");
    expect(mesesEntre("2026-11-01", "2027-02-01")).toEqual([
      "2026-11-01",
      "2026-12-01",
      "2027-01-01",
      "2027-02-01",
    ]);
    expect(mesesEntre("2027-02-01", "2026-11-01")).toEqual([]);
    expect(rotuloMes("2027-01-01")).toBe("jan/27");
  });

  it("nome do mês", () => {
    expect(numeroDoMes("Março")).toBe(3);
    expect(numeroDoMes("set.")).toBe(9);
    expect(numeroDoMes("setembro")).toBe(9);
    expect(numeroDoMes("marco zero")).toBeNull();
    expect(numeroDoMes("xx")).toBeNull();
  });
});

describe("curva S", () => {
  const previsto = [
    v("2026-06-01", 500),
    v("2026-07-01", 300),
    v("2026-09-01", 200),
  ];
  const realizado = [
    v("2026-06-01", 500),
    v("2026-07-01", 250),
    v("2026-07-01", 10),
  ];

  it("acumula mês a mês (mês sem valor entra) e para o realizado no mês atual", () => {
    expect(curvaS(previsto, realizado, { atual: "2026-08-01" })).toEqual([
      {
        mes: "2026-06-01",
        previsto: 500,
        realizado: 500,
        previstoAcum: 500,
        realizadoAcum: 500,
      },
      {
        mes: "2026-07-01",
        previsto: 300,
        realizado: 260,
        previstoAcum: 800,
        realizadoAcum: 760,
      },
      {
        mes: "2026-08-01",
        previsto: 0,
        realizado: 0,
        previstoAcum: 800,
        realizadoAcum: 760,
      },
      {
        mes: "2026-09-01",
        previsto: 200,
        realizado: 0,
        previstoAcum: 1000,
        realizadoAcum: null,
      },
    ]);
  });

  it("o período corta a vista, mas o acumulado conta desde o início", () => {
    const c = curvaS(previsto, realizado, {
      atual: "2026-09-01",
      de: "2026-07-01",
      ate: "2026-08-01",
    });
    expect(c.map((p) => [p.mes, p.previstoAcum, p.realizadoAcum])).toEqual([
      ["2026-07-01", 800, 760],
      ["2026-08-01", 800, 760],
    ]);
  });

  it("sem dados: vazio", () => {
    expect(curvaS([], [], { atual: "2026-01-01" })).toEqual([]);
  });
});

describe("indicadores da obra", () => {
  const previsto = [
    v("2026-07-01", 100_000),
    v("2026-08-01", 100_000),
    v("2026-09-01", 100_000),
  ];

  it("índice, desvio do mês e saldo", () => {
    const i = indicadoresDaObra({
      orcado: 300_000,
      previsto,
      realizado: [v("2026-07-01", 100_000), v("2026-08-01", 95_000)],
      mesRef: "2026-08-01",
      limites: LIMITES,
    });
    expect(i.realizado).toBe(195_000);
    expect(i.saldo).toBe(105_000);
    expect(i.previstoAteMes).toBe(200_000);
    expect(i.desvioNoMes).toBe(-5_000);
    expect(i.indice).toBeCloseTo(0.975);
    expect(i.desvioPontos).toBeCloseTo(-2.5);
    expect(i.ritmo.status).toBe("ok");
    expect(i.orcamento).toMatchObject({
      status: "ok",
      rotulo: "Dentro do orçado",
    });
    expect(i.pctExecutado).toBeCloseTo(65);
  });

  it("abaixo do limite de desvio (parâmetro) fica fora; acima do previsto, atenção", () => {
    const abaixo = indicadoresDaObra({
      orcado: 300_000,
      previsto,
      realizado: [v("2026-07-01", 80_000), v("2026-08-01", 90_000)],
      mesRef: "2026-08-01",
      limites: LIMITES,
    });
    expect(abaixo.ritmo).toMatchObject({
      status: "fora",
      rotulo: "Abaixo do previsto",
    });
    expect(abaixo.ritmo.detalhe).toContain("-15,0 pontos");
    const acima = indicadoresDaObra({
      orcado: 300_000,
      previsto,
      realizado: [v("2026-07-01", 230_000)],
      mesRef: "2026-08-01",
      limites: LIMITES,
    });
    expect(acima.ritmo.status).toBe("atencao");
  });

  it("sem previsto até o mês", () => {
    const i = indicadoresDaObra({
      orcado: 300_000,
      previsto,
      realizado: [],
      mesRef: "2026-06-01",
      limites: LIMITES,
    });
    expect(i.indice).toBeNull();
    expect(i.ritmo.status).toBe("sem_dado");
  });

  it("orçamento: tolerância em % antes do estouro", () => {
    expect(situacaoDoOrcamento(100_000, 105_000, LIMITES).status).toBe(
      "atencao",
    );
    expect(situacaoDoOrcamento(100_000, 110_000, LIMITES).status).toBe(
      "atencao",
    );
    expect(situacaoDoOrcamento(100_000, 110_001, LIMITES)).toMatchObject({
      status: "fora",
      rotulo: "Estouro do orçamento",
    });
    expect(situacaoDoOrcamento(0, 0, LIMITES).status).toBe("sem_dado");
    expect(situacaoDoOrcamento(0, 10, LIMITES).status).toBe("fora");
  });
});

const etapas = (lista: [string, [string, number][]][]): EtapaPrevista[] =>
  lista.map(([nome, valores], i) => ({
    nome,
    ordem: i + 1,
    observacao: null,
    previsto: valores.map(([mes, c]) => v(mes, c)),
  }));

describe("por etapa", () => {
  it("casa o realizado pelo nome (sem acento e caixa) e mostra o que não casa à parte", () => {
    const linhas = linhasPorEtapa(
      etapas([
        [
          "Térreo",
          [
            ["2026-07-01", 1000],
            ["2026-08-01", 1000],
          ],
        ],
        ["Pavimento 1", [["2026-09-01", 500]]],
      ]),
      [
        { etapa: "TERREO", mes: "2026-07-01", centavos: 1200 },
        { etapa: "Térreo", mes: "2026-08-01", centavos: 1000 },
        { etapa: "Castelo", mes: "2026-08-01", centavos: 300 },
      ],
      "2026-08-01",
      LIMITES,
    );
    expect(
      linhas.map((l) => [
        l.nome,
        l.naRevisao,
        l.previsto,
        l.previstoAteMes,
        l.realizado,
      ]),
    ).toEqual([
      ["Térreo", true, 2000, 2000, 2200],
      ["Pavimento 1", true, 500, 0, 0],
      ["Castelo", false, 0, 0, 300],
    ]);
    expect(linhas[0]?.orcamento.status).toBe("atencao");
    expect(linhas[2]?.orcamento.status).toBe("fora");
  });
});

describe("comparação entre revisões", () => {
  it("diz o que mudou em cada etapa", () => {
    const r00 = etapas([
      [
        "Térreo",
        [
          ["2026-07-01", 1000],
          ["2026-08-01", 1000],
        ],
      ],
      ["Pavimento 1", [["2026-09-01", 500]]],
      ["Castelo", [["2026-10-01", 300]]],
      ["Casa de máquinas", []],
    ]);
    const r01 = etapas([
      [
        "Térreo",
        [
          ["2026-07-01", 1000],
          ["2026-08-01", 1500],
        ],
      ],
      ["Pavimento 1", [["2026-10-01", 500]]],
      ["Casa de máquinas", []],
      ["Cobertura", [["2027-01-01", 700]]],
    ]);
    const c = compararRevisoes(r00, r01);
    expect(c.map((l) => [l.nome, l.mudanca, l.diferenca])).toEqual([
      ["Térreo", "valor", 500],
      ["Pavimento 1", "periodo", 0],
      ["Casa de máquinas", "igual", 0],
      ["Cobertura", "nova", 700],
      ["Castelo", "removida", -300],
    ]);
    expect(c[1]?.periodoAntes).toEqual({ de: "2026-09-01", ate: "2026-09-01" });
    expect(c[1]?.mesesAlterados).toBe(2);
  });
});

describe("próxima revisão", () => {
  it("usa a da planilha se ainda não existe; senão a seguinte, com aviso", () => {
    expect(proximaRevisao([], "R00")).toEqual({ codigo: "R00", aviso: null });
    expect(proximaRevisao(["R00"], "R01")).toEqual({
      codigo: "R01",
      aviso: null,
    });
    const repetida = proximaRevisao(["R00", "R01"], "R01");
    expect(repetida?.codigo).toBe("R02");
    expect(repetida?.aviso).toContain("já existe");
    expect(proximaRevisao([], null)).toMatchObject({ codigo: "R00" });
    expect(proximaRevisao(["R99"], "R99")).toBeNull();
  });
});
