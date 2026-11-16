import { describe, expect, it } from "vitest";
import {
  formatarMesNumerico,
  formatarPercentual,
  formatarReais,
  formatarToneladas,
} from "./formatos";
import {
  avisoDeConsolidado,
  desdeOInicio,
  mesmoMesDoAnoAnterior,
  valorOuSemDado,
  variacao,
} from "./painel";

describe("formatos", () => {
  it("reais, toneladas, percentual e mês", () => {
    expect(formatarReais(1234.56)).toBe("1.234,56");
    expect(formatarReais(null)).toBe("—");
    expect(formatarToneladas(24)).toBe("24,00");
    expect(formatarPercentual((27 / 178) * 100)).toBe("15,2%");
    expect(formatarMesNumerico("2026-11-01")).toBe("11/2026");
    expect(formatarMesNumerico("2026-03")).toBe("03/2026");
  });
});

describe("valorOuSemDado", () => {
  it("sem dado em mm/aaaa, nunca zero; zero de verdade aparece", () => {
    expect(valorOuSemDado(null, "2026-10-01")).toBe("sem dado em 10/2026");
    expect(valorOuSemDado(undefined, "2026-10-01")).toBe("sem dado em 10/2026");
    expect(valorOuSemDado(0, "2026-10-01")).toBe("0");
    expect(valorOuSemDado(96300, "2026-10-01")).toBe("96.300");
    expect(valorOuSemDado(24, "2026-10-01", formatarToneladas)).toBe("24,00");
  });
});

describe("variação sobre o mesmo mês do ano anterior", () => {
  it("mês anterior e percentual", () => {
    expect(mesmoMesDoAnoAnterior("2026-11-01")).toBe("2025-11-01");
    expect(variacao(110, 100)).toBeCloseTo(10);
    expect(variacao(90, 100)).toBeCloseTo(-10);
    expect(variacao(90, null)).toBeNull();
    expect(variacao(null, 100)).toBeNull();
    expect(variacao(5, 0)).toBeNull();
  });
});

describe("desdeOInicio", () => {
  it("marcos + anos no sistema, sem contar duas vezes o ano do marco", () => {
    expect(
      desdeOInicio(
        [
          { ano: 2024, valor: 18420 },
          { ano: 2025, valor: 22830 },
        ],
        [
          { ano: 2025, valor: 1 },
          { ano: 2026, valor: 1000 },
          { ano: 2027, valor: null },
        ],
      ),
    ).toBe(42250);
    expect(desdeOInicio([], [{ ano: 2026, valor: null }])).toBeNull();
  });
});

describe("avisoDeConsolidado", () => {
  const fechado = {
    situacao: "fechado",
    totais: { volume_kg: 1000, rcc_t: 32, agua: null },
  };

  it("fechado e diferente: lista o que mudou", () => {
    expect(
      avisoDeConsolidado(fechado, { volume_kg: 1010, rcc_t: 32, agua: null }),
    ).toEqual([{ indicador: "volume_kg", consolidado: 1000, atual: 1010 }]);
  });

  it("indicador novo ou que perdeu dado também avisa", () => {
    expect(
      avisoDeConsolidado(fechado, {
        volume_kg: 1000,
        rcc_t: null,
        agua: null,
        novo: 5,
      }),
    ).toEqual([
      { indicador: "rcc_t", consolidado: 32, atual: null },
      { indicador: "novo", consolidado: null, atual: 5 },
    ]);
  });

  it("igual, reaberto ou sem consolidado: sem aviso", () => {
    expect(avisoDeConsolidado(fechado, { ...fechado.totais })).toBeNull();
    expect(
      avisoDeConsolidado(
        { ...fechado, situacao: "reaberto" },
        { volume_kg: 1 },
      ),
    ).toBeNull();
    expect(avisoDeConsolidado(null, { volume_kg: 1 })).toBeNull();
  });
});
