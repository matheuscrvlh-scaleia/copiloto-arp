import { describe, expect, it } from "vitest";
import { descreverPublico, diasDa, ocorrencias, quando } from "./calendario";

const item = (
  inicio: string,
  fim: string,
  recorrencia: "diaria" | "semanal" | "mensal" | "anual" | null = null,
  recorrencia_ate: string | null = null,
) => ({ inicio, fim, recorrencia, recorrencia_ate });

describe("ocorrencias", () => {
  it("sem recorrência: uma vez, se encosta no período", () => {
    expect(
      ocorrencias(item("2026-11-10", "2026-11-12"), "2026-11-12", "2026-11-30"),
    ).toEqual([{ inicio: "2026-11-10", fim: "2026-11-12" }]);
    expect(
      ocorrencias(item("2026-11-10", "2026-11-12"), "2026-11-13", "2026-11-30"),
    ).toEqual([]);
    expect(
      ocorrencias(item("2026-12-01", "2026-12-01"), "2026-11-01", "2026-11-30"),
    ).toEqual([]);
  });

  it("semanal: só as do período, mesmo com série antiga", () => {
    const r = ocorrencias(
      item("2025-01-06", "2025-01-06", "semanal"),
      "2026-11-01",
      "2026-11-30",
    );
    expect(r.map((o) => o.inicio)).toEqual([
      "2026-11-02",
      "2026-11-09",
      "2026-11-16",
      "2026-11-23",
      "2026-11-30",
    ]);
  });

  it("diária respeita o fim da série; a de vários dias que começa antes entra", () => {
    expect(
      ocorrencias(
        item("2026-11-01", "2026-11-01", "diaria", "2026-11-03"),
        "2026-11-02",
        "2026-11-30",
      ).map((o) => o.inicio),
    ).toEqual(["2026-11-02", "2026-11-03"]);
    expect(
      ocorrencias(
        item("2026-10-26", "2026-10-28", "semanal"),
        "2026-11-04",
        "2026-11-04",
      ),
    ).toEqual([{ inicio: "2026-11-02", fim: "2026-11-04" }]);
  });

  it("mensal no dia 31 cai no último dia do mês curto; anual repete a data", () => {
    expect(
      ocorrencias(
        item("2026-01-31", "2026-01-31", "mensal"),
        "2026-02-01",
        "2026-04-30",
      ).map((o) => o.inicio),
    ).toEqual(["2026-02-28", "2026-03-31", "2026-04-30"]);
    expect(
      ocorrencias(
        item("2020-11-06", "2020-11-06", "anual"),
        "2026-11-01",
        "2026-11-30",
      ).map((o) => o.inicio),
    ).toEqual(["2026-11-06"]);
  });
});

describe("quando e dias", () => {
  it("descreve a hora do dia", () => {
    const o = {
      inicio: "2026-11-10",
      fim: "2026-11-10",
      hora_inicio: "08:00:00",
      hora_fim: "09:30:00",
    };
    expect(quando(o, "2026-11-10")).toBe("08:00–09:30");
    expect(
      quando({ ...o, hora_inicio: null, hora_fim: null }, "2026-11-10"),
    ).toBe("Dia inteiro");
    const longo = { ...o, fim: "2026-11-12" };
    expect(quando(longo, "2026-11-10")).toBe("Desde 08:00");
    expect(quando(longo, "2026-11-11")).toBe("Dia inteiro");
    expect(quando(longo, "2026-11-12")).toBe("Até 09:30");
  });

  it("corta os dias no período da tela", () => {
    expect(
      diasDa(
        { inicio: "2026-10-30", fim: "2026-11-02" },
        "2026-11-01",
        "2026-11-30",
      ),
    ).toEqual(["2026-11-01", "2026-11-02"]);
  });

  it("descreve o público", () => {
    expect(descreverPublico("restrito", ["Obras", "Financeiro", "Ana"])).toBe(
      "Obras, Financeiro e Ana",
    );
    expect(descreverPublico("todos", [])).toMatch(/Todos/);
  });
});
