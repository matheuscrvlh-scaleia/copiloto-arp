import { describe, expect, it } from "vitest";
import {
  aguaPorMes,
  conferirPeriodo,
  solarDoInversor,
  solarPorMes,
} from "./por-mes";

describe("água e solar por mês (para o Sustentabilidade)", () => {
  it("recusa período fora do formato ou invertido", () => {
    expect(() => conferirPeriodo("2026-01-01", "2026-03-01")).not.toThrow();
    expect(() => conferirPeriodo("2026-01-15", "2026-03-01")).toThrow();
    expect(() => conferirPeriodo("2026-03-01", "2026-01-01")).toThrow();
  });

  it("soma por mês e por bloco, com o bloco corrigido pelo vínculo", () => {
    const l = (
      referencia: string,
      hidrometro: string,
      bloco: string,
      consumo: number | string,
    ) => ({ referencia, hidrometro, bloco, consumo, exemplo: false });
    const r = aguaPorMes(
      [
        l("2026-02-01", "H1", "A", 0.1),
        l("2026-02-01", "H2", "A", 0.2),
        l("2026-02-01", "H3", "B", "1.5"),
        l("2026-01-01", "H1", "A", 3),
        l("2026-01-01", "H3", "B", 2),
      ],
      // H3 passa para o bloco C a partir de fevereiro.
      [{ hidrometro: "H3", desde: "2026-02-01", bloco: "C", sala: "1" }],
      [
        { referencia: "2026-02-01", incompleta: true },
        { referencia: "2026-01-01", incompleta: false },
      ],
    );
    expect(r).toEqual([
      {
        mes: "2026-01-01",
        m3_total: 5,
        por_bloco: { A: 3, B: 2 },
        incompleta: false,
        exemplo: false,
      },
      {
        mes: "2026-02-01",
        m3_total: 1.8,
        por_bloco: { A: 0.3, C: 1.5 },
        incompleta: true,
        exemplo: false,
      },
    ]);
  });

  it("mês sem leitura não aparece", () => {
    expect(
      aguaPorMes([], [], [{ referencia: "2026-01-01", incompleta: true }]),
    ).toEqual([]);
  });

  it("solar: só a fatura da geradora, só os meses com geração lida", () => {
    const unidades = new Map([
      ["G1", { papel: "gera" as const }],
      ["G2", { papel: "gera_e_consome" as const }],
      ["C1", { papel: "consome" as const }],
    ]);
    const f = (
      matricula: string,
      referencia: string,
      injetada_kwh: number | null,
      leitura_atual_data: string | null,
    ) => ({
      matricula,
      referencia,
      injetada_kwh,
      leitura_atual_data,
      exemplo: false,
    });
    const faturas = [
      f("G1", "2026-01-01", 100.555, "2026-01-28"),
      f("G2", "2026-01-01", 50, "2026-01-30"),
      f("C1", "2026-01-01", 999, "2026-01-31"),
      // Fevereiro: a geradora veio sem a injetada (sem dado).
      f("G1", "2026-02-01", null, "2026-02-27"),
      f("C1", "2026-02-01", 10, "2026-02-27"),
    ];
    expect(solarPorMes(faturas, unidades, "fatura_geradora")).toEqual([
      {
        mes: "2026-01-01",
        kwh: 150.56,
        co2_t: null,
        ultima_leitura: "2026-01-30",
        exemplo: false,
      },
    ]);
    expect(solarPorMes(faturas, unidades, "a_confirmar")).toEqual([]);
    expect(solarPorMes(faturas, unidades, "inversor")).toEqual([]);
  });
});

describe("geração pelo inversor por mês", () => {
  it("cada mês com a soma e o último dia lido, em ordem e arredondado", () => {
    expect(
      solarDoInversor([
        { mes: "2026-11-01", kwh: 601.499999, ultimo_dia: "2026-11-02" },
        { mes: "2026-10-01", kwh: 250.4, ultimo_dia: "2026-10-31" },
      ]),
    ).toEqual([
      {
        mes: "2026-10-01",
        kwh: 250.4,
        co2_t: null,
        ultima_leitura: "2026-10-31",
        exemplo: false,
      },
      {
        mes: "2026-11-01",
        kwh: 601.5,
        co2_t: null,
        ultima_leitura: "2026-11-02",
        exemplo: false,
      },
    ]);
  });

  it("sem dias lidos, nenhum mês (nada de zero inventado)", () => {
    expect(solarDoInversor([])).toEqual([]);
  });
});
