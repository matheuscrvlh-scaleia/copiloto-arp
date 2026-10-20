import { describe, expect, it } from "vitest";
import { horasEmMinutos, numeroBr, totaisDoCalculo } from "./calculo";

describe("horasEmMinutos", () => {
  it.each([
    ["08:48", 528],
    ["176:00", 10560],
    ["-12:30", -750],
    ["", 0],
    [null, 0],
  ])("%s → %d", (entrada, esperado) => {
    expect(horasEmMinutos(entrada)).toBe(esperado);
  });

  it("recusa formato desconhecido em vez de virar zero", () => {
    expect(() => horasEmMinutos("8h")).toThrow();
  });
});

describe("numeroBr", () => {
  it("lê vírgula decimal", () => {
    expect(numeroBr("1,50")).toBe(1.5);
    expect(numeroBr("")).toBe(0);
  });
});

describe("totaisDoCalculo", () => {
  it("lê os totais pelo nome da coluna, na ordem que vier", () => {
    const t = totaisDoCalculo({
      Colunas: [
        "Data",
        "Faltas",
        "Carga",
        "Abono2",
        "BSaldo",
        "FaltasDias",
        "Atras.",
      ],
      Linhas: [],
      Totais: ["", "08:00", "176:00", "04:00", "-02:15", "1,00", "00:30"],
    });
    expect(t).toEqual({
      previstas_min: 10560,
      normais_min: 0,
      faltas_min: 480,
      atrasos_min: 30,
      faltas_dias: 1,
      abonos_min: { Abono2: 240 },
      banco_saldo_min: -135,
      banco_creditos_min: 0,
      banco_debitos_min: 0,
    });
  });
});
