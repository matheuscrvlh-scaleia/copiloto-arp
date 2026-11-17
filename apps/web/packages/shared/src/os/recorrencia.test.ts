import { describe, expect, it } from "vitest";
import {
  datasEntre,
  descreverRecorrencia,
  proximaData,
  type Recorrencia,
} from "./recorrencia";

describe("próxima data", () => {
  it("diária e a cada N dias viram o ano", () => {
    expect(proximaData({ frequencia: "diaria" }, "2026-12-31")).toBe(
      "2027-01-01",
    );
    expect(
      proximaData({ frequencia: "cada_n_dias", intervalo: 15 }, "2026-12-20"),
    ).toBe("2027-01-04");
  });

  it("semanal nos dias marcados", () => {
    const r: Recorrencia = { frequencia: "semanal", dias_semana: [1, 3] };
    // 2026-10-23 é sexta.
    expect(proximaData(r, "2026-10-23")).toBe("2026-10-26");
    expect(proximaData(r, "2026-10-26")).toBe("2026-10-28");
    expect(proximaData(r, "2026-12-30")).toBe("2027-01-04");
  });

  it("a cada 2 semanas pula a semana do meio", () => {
    const r: Recorrencia = {
      frequencia: "semanal",
      intervalo: 2,
      dias_semana: [1, 3],
    };
    expect(proximaData(r, "2026-10-19")).toBe("2026-10-21");
    expect(proximaData(r, "2026-10-21")).toBe("2026-11-02");
  });

  it("mensal: dia 31 vira o último dia em mês curto", () => {
    const r: Recorrencia = { frequencia: "mensal", dia_mes: 31 };
    expect(proximaData(r, "2026-01-31")).toBe("2026-02-28");
    expect(proximaData(r, "2026-02-28")).toBe("2026-03-31");
    expect(proximaData(r, "2028-01-31")).toBe("2028-02-29");
    expect(proximaData(r, "2026-12-31")).toBe("2027-01-31");
  });

  it("mensal ainda no mesmo mês quando o dia não passou", () => {
    expect(
      proximaData({ frequencia: "mensal", dia_mes: 5 }, "2026-10-03"),
    ).toBe("2026-10-05");
  });

  it("a cada N meses", () => {
    expect(
      proximaData(
        { frequencia: "cada_n_meses", intervalo: 3, dia_mes: 30 },
        "2026-11-30",
      ),
    ).toBe("2027-02-28");
  });

  it("depois do fim: null", () => {
    expect(
      proximaData({ frequencia: "diaria", fim: "2026-10-23" }, "2026-10-23"),
    ).toBeNull();
  });
});

describe("datas entre", () => {
  it("inclui o início quando ele já é uma ocorrência", () => {
    expect(
      datasEntre(
        { frequencia: "semanal", dias_semana: [1, 3] },
        "2026-10-26",
        "2026-11-04",
      ),
    ).toEqual(["2026-10-26", "2026-10-28", "2026-11-02", "2026-11-04"]);
  });

  it("fevereiro e o fim", () => {
    expect(
      datasEntre(
        { frequencia: "mensal", dia_mes: 31, fim: "2026-04-15" },
        "2026-01-01",
        "2026-12-31",
      ),
    ).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });
});

describe("descrição", () => {
  it("textos", () => {
    expect(
      descreverRecorrencia({ frequencia: "semanal", dias_semana: [3, 1] }),
    ).toBe("Toda semana, seg e qua");
    expect(descreverRecorrencia({ frequencia: "mensal", dia_mes: 5 })).toBe(
      "Todo mês, dia 5",
    );
    expect(
      descreverRecorrencia({ frequencia: "cada_n_dias", intervalo: 15 }),
    ).toBe("A cada 15 dias");
    expect(descreverRecorrencia({ frequencia: "diaria" })).toBe("Todo dia");
    expect(
      descreverRecorrencia({
        frequencia: "cada_n_meses",
        intervalo: 3,
        dia_mes: 10,
        fim: "2027-12-31",
      }),
    ).toBe("A cada 3 meses, dia 10, até 31/12/2027");
    expect(
      descreverRecorrencia({
        frequencia: "semanal",
        dias_semana: [0, 5, 1],
      }),
    ).toBe("Toda semana, seg, sex e dom");
  });
});
