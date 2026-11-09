import { describe, expect, it } from "vitest";
import {
  consumoPorMes,
  filtroDoExtrato,
  MESES_MAX_EXTRATO,
  mesesEntre,
  noExtrato,
} from "./agua-extrato";

const l = {
  bloco: "05",
  sala: "107 e 108",
  cliente: "Ateliê Lume – UNIFICADO",
  hidrometro: "A24AK0070837",
};

describe("extrato da água", () => {
  it("acha pela sala, pelo cliente e pelo hidrômetro", () => {
    expect(noExtrato(l, { bloco: "", texto: "108" })).toBe(true);
    expect(noExtrato(l, { bloco: "05", texto: "107" })).toBe(true);
    expect(noExtrato(l, { bloco: "04", texto: "107" })).toBe(false);
    expect(noExtrato(l, { bloco: "", texto: "atelie" })).toBe(true);
    expect(noExtrato(l, { bloco: "", texto: "ak0070" })).toBe(true);
    expect(noExtrato(l, { bloco: "", texto: "10" })).toBe(false);
    expect(noExtrato(l, { bloco: "", texto: "" })).toBe(false);
    expect(noExtrato(l, { bloco: "05", texto: "" })).toBe(true);
  });

  it("lista os meses do período, com limite", () => {
    expect(mesesEntre("2025-11-01", "2026-02-01")).toEqual([
      "2025-11-01",
      "2025-12-01",
      "2026-01-01",
      "2026-02-01",
    ]);
    expect(mesesEntre("2020-01-01", "2026-09-01")).toHaveLength(
      MESES_MAX_EXTRATO,
    );
    expect(mesesEntre("2026-09-01", "2026-08-01")).toEqual([]);
  });

  it("soma o consumo do mês (troca de hidrômetro no mesmo mês)", () => {
    expect(
      consumoPorMes(
        [
          { referencia: "2026-08-01", consumo: 1.1 },
          { referencia: "2026-08-01", consumo: 2.2 },
        ],
        ["2026-07-01", "2026-08-01"],
      ),
    ).toEqual([
      { referencia: "2026-07-01", consumo: null },
      { referencia: "2026-08-01", consumo: 3.3 },
    ]);
  });
});

describe("filtro do extrato pela URL", () => {
  const meses = ["2026-09-01", "2026-08-01"];

  it("sem período: 12 meses até o último importado", () => {
    expect(filtroDoExtrato({ q: " 108 " }, meses)).toEqual({
      de: "2025-10-01",
      ate: "2026-09-01",
      bloco: "",
      texto: "108",
    });
  });

  it("período invertido, bloco inválido e o nº do hidrômetro", () => {
    expect(
      filtroDoExtrato(
        { de: "2026-09", ate: "2026-01", bloco: "5x", h: "A1B2" },
        meses,
      ),
    ).toEqual({
      de: "2026-01-01",
      ate: "2026-09-01",
      bloco: "",
      texto: "A1B2",
    });
  });

  it("limita o período e sem mês importado não há extrato", () => {
    expect(filtroDoExtrato({ de: "2020-01" }, meses)?.de).toBe("2024-10-01");
    expect(filtroDoExtrato({}, [])).toBeNull();
  });
});
