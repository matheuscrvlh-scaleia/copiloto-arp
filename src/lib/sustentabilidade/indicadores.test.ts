import { describe, expect, it } from "vitest";
import {
  calcularIndicador,
  type DefinicaoIndicador,
  type Lancamento,
  numeroDoValor,
  somaPorGrupo,
  textosDoValor,
  valorDoIndicador,
} from "./indicadores";

const def = (o: Partial<DefinicaoIndicador>): DefinicaoIndicador => ({
  campoId: "produtor",
  calculo: "contagem",
  filtro: null,
  ...o,
});

// Produtores na feira (spec 8): a mesma produtora em 4 feiras do mês e outras
// 3 produtoras em 1 feira cada. Um lançamento por produtor e feira.
const FEIRAS: Lancamento[] = [
  { data: "2026-11-01", valores: { produtor: "Maria Queijos" } },
  { data: "2026-11-08", valores: { produtor: "maria queijos " } },
  { data: "2026-11-15", valores: { produtor: "Maria Queijos" } },
  { data: "2026-11-22", valores: { produtor: "Maria Queijos" } },
  { data: "2026-11-01", valores: { produtor: "Sítio Boa Vista" } },
  { data: "2026-11-08", valores: { produtor: "Mel da Serra" } },
  { data: "2026-11-15", valores: { produtor: "Pães do Vale" } },
];

describe("valores dos campos", () => {
  it("número, texto em reais, número com unidade e sim/não", () => {
    expect(numeroDoValor(12)).toBe(12);
    expect(numeroDoValor("1.234,5")).toBe(1234.5);
    expect(numeroDoValor({ n: 3, u: "kg" })).toBe(3);
    expect(numeroDoValor("abc")).toBeNull();
    expect(numeroDoValor(["1"])).toBeNull();
    expect(textosDoValor({ r: "sim", d: "2 banheiros" })).toEqual(["sim"]);
    expect(textosDoValor(["Oficina", "DJ"])).toEqual(["oficina", "dj"]);
    expect(textosDoValor(undefined)).toEqual([]);
  });
});

describe("participações × produtores únicos (spec 8)", () => {
  it("participações 7, únicos 4", () => {
    expect(valorDoIndicador(def({ calculo: "contagem" }), FEIRAS)).toBe(7);
    expect(
      valorDoIndicador(def({ calculo: "contagem_distintos" }), FEIRAS),
    ).toBe(4);
  });

  it("um lançamento por feira com várias produtoras dá o mesmo", () => {
    const porFeira: Lancamento[] = [
      {
        data: "2026-11-01",
        valores: {
          produtor: [
            "Maria Queijos",
            "Sítio Boa Vista",
            "Mel da Serra",
            "Pães do Vale",
          ],
        },
      },
      { data: "2026-11-08", valores: { produtor: ["Maria Queijos"] } },
      { data: "2026-11-15", valores: { produtor: ["Maria Queijos"] } },
      { data: "2026-11-22", valores: { produtor: ["Maria Queijos"] } },
    ];
    expect(valorDoIndicador(def({ calculo: "contagem" }), porFeira)).toBe(7);
    expect(
      valorDoIndicador(def({ calculo: "contagem_distintos" }), porFeira),
    ).toBe(4);
  });

  it("distintos no ano são os do ano, nunca a soma dos meses", () => {
    const lancs: Lancamento[] = [
      { data: "2026-01-10", valores: { produtor: "Maria" } },
      { data: "2026-02-10", valores: { produtor: "Maria" } },
      { data: "2026-02-17", valores: { produtor: "João" } },
      { data: "2025-12-20", valores: { produtor: "Fora" } },
    ];
    const r = calcularIndicador(def({ calculo: "contagem_distintos" }), lancs, [
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
    ]);
    expect(r.porMes).toEqual([
      { competencia: "2026-01-01", valor: 1 },
      { competencia: "2026-02-01", valor: 2 },
      { competencia: "2026-03-01", valor: null },
    ]);
    expect(r.periodo).toBe(2);
  });
});

describe("soma, média, filtro e percentual", () => {
  const ATRACOES: Lancamento[] = [
    {
      data: "2026-11-02",
      valores: { tipo: "Oficina", horas: 2, publico: "Turista" },
    },
    {
      data: "2026-11-03",
      valores: { tipo: "DJ", horas: { n: 3, u: "h" }, publico: "Friburguense" },
    },
    {
      data: "2026-11-04",
      valores: { tipo: "oficina", horas: "1,5", publico: "Turista" },
    },
    { data: "2026-11-05", valores: { tipo: "Feira", publico: "Trabalhador" } },
  ];

  it("soma ignora vazio; média só dos números", () => {
    expect(
      valorDoIndicador(def({ campoId: "horas", calculo: "soma" }), ATRACOES),
    ).toBe(6.5);
    expect(
      valorDoIndicador(def({ campoId: "horas", calculo: "media" }), ATRACOES),
    ).toBeCloseTo(6.5 / 3);
  });

  it("contagem com filtro (tipo = oficina, sem acento/caixa)", () => {
    const oficinas = def({
      campoId: "tipo",
      filtro: { campoId: "tipo", valor: "Oficina" },
    });
    expect(valorDoIndicador(oficinas, ATRACOES)).toBe(2);
    expect(
      valorDoIndicador(
        { ...oficinas, filtro: { campoId: "tipo", valor: "Massagem" } },
        ATRACOES,
      ),
    ).toBe(0);
  });

  it("percentual = linhas com o valor ÷ linhas filtradas", () => {
    const turistas = def({
      campoId: "publico",
      calculo: "percentual",
      percentualValor: "Turista",
    });
    expect(valorDoIndicador(turistas, ATRACOES)).toBe(50);
    expect(
      valorDoIndicador(
        { ...turistas, filtro: { campoId: "tipo", valor: "Oficina" } },
        ATRACOES,
      ),
    ).toBe(100);
    expect(
      valorDoIndicador(
        { ...turistas, filtro: { campoId: "tipo", valor: "Nada" } },
        ATRACOES,
      ),
    ).toBeNull();
  });

  it("sem lançamento é null (sem dado), nunca zero", () => {
    expect(valorDoIndicador(def({ calculo: "soma" }), [])).toBeNull();
  });
});

describe("somaPorGrupo", () => {
  it("soma os somáveis do mesmo grupo e deixa únicos à parte", () => {
    const grupos = somaPorGrupo([
      {
        nome: "Participações",
        grupo: "Produtores locais",
        calculo: "contagem",
        valor: 7,
      },
      {
        nome: "Produtores únicos",
        grupo: "Produtores locais",
        calculo: "contagem_distintos",
        valor: 4,
      },
      {
        nome: "Participantes oficina",
        grupo: "Pessoas impactadas",
        calculo: "soma",
        valor: 30,
      },
      {
        nome: "Visitantes",
        grupo: "Pessoas impactadas",
        calculo: "soma",
        valor: 120,
      },
      {
        nome: "Tours",
        grupo: "Pessoas impactadas",
        calculo: "soma",
        valor: null,
      },
      { nome: "Sem grupo", grupo: null, calculo: "soma", valor: 99 },
    ]);
    expect(grupos).toHaveLength(2);
    const prod = grupos.find((g) => g.grupo === "Produtores locais");
    expect(prod?.soma).toBe(7);
    expect(prod?.aParte.map((i) => [i.nome, i.valor])).toEqual([
      ["Produtores únicos", 4],
    ]);
    expect(grupos.find((g) => g.grupo === "Pessoas impactadas")?.soma).toBe(
      150,
    );
  });

  it("grupo sem dado nenhum fica null", () => {
    expect(
      somaPorGrupo([
        { nome: "Kg", grupo: "Volume reciclado", calculo: "soma", valor: null },
      ])[0]?.soma,
    ).toBeNull();
  });
});
