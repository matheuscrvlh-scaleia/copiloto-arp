import { describe, expect, it } from "vitest";
import {
  aniversarioEm,
  anosCompletos,
  competenciasEntre,
  diasUteisEntre,
  ehDiaUtil,
  fimDoMesDe,
  mesesCompletos,
  somarDiasUteis,
  somarMeses,
} from "./datas";
import { dadosDe, formatarArea, formatarValor } from "./formato";

const cal = {
  feriados: new Set(["2026-11-02", "2026-11-15", "2026-11-20"]),
  diasUteis: [1, 2, 3, 4, 5],
};

describe("datas do Comercial", () => {
  it("soma meses e para no último dia do mês", () => {
    expect(somarMeses("2026-01-31", 1)).toBe("2026-02-28");
    expect(somarMeses("2024-01-31", 1)).toBe("2024-02-29");
    expect(somarMeses("2026-11-04", 14)).toBe("2028-01-04");
    expect(somarMeses("2026-03-15", -3)).toBe("2025-12-15");
  });

  it("meses e anos completos", () => {
    expect(mesesCompletos("2024-03-15", "2026-03-14")).toBe(23);
    expect(mesesCompletos("2024-03-15", "2026-03-15")).toBe(24);
    expect(mesesCompletos("2026-03-15", "2024-03-15")).toBe(-24);
    expect(anosCompletos("2019-11-05", "2026-11-04")).toBe(6);
    expect(anosCompletos("2019-11-04", "2026-11-04")).toBe(7);
  });

  it("aniversário no ano e competências", () => {
    expect(aniversarioEm("1980-02-29", 2026)).toBe("2026-02-28");
    expect(aniversarioEm("1980-02-29", 2028)).toBe("2028-02-29");
    expect(competenciasEntre("2025-11-20", "2026-02-03")).toEqual([
      "2025-11-01",
      "2025-12-01",
      "2026-01-01",
      "2026-02-01",
    ]);
    expect(fimDoMesDe("2026-02-10")).toBe("2026-02-28");
  });

  it("dias úteis com feriados", () => {
    expect(ehDiaUtil("2026-11-02", cal)).toBe(false);
    expect(ehDiaUtil("2026-11-07", cal)).toBe(false);
    expect(ehDiaUtil("2026-11-03", cal)).toBe(true);
    // Sexta 30/10 + 1 dia útil: pula o fim de semana e o feriado de 02/11.
    expect(somarDiasUteis("2026-10-30", 1, cal)).toBe("2026-11-03");
    expect(somarDiasUteis("2026-11-04", 0, cal)).toBe("2026-11-04");
    expect(diasUteisEntre("2026-10-30", "2026-11-06", cal)).toBe(4);
    expect(diasUteisEntre("2026-11-06", "2026-10-30", cal)).toBe(0);
    const n = diasUteisEntre("2026-11-04", "2026-12-16", cal);
    expect(somarDiasUteis("2026-11-04", n, cal)).toBe("2026-12-16");
  });

  it("formatos", () => {
    expect(formatarValor(1234.5)).toBe("1.234,50");
    expect(formatarValor(-10)).toBe("-10,00");
    expect(formatarValor(null)).toBe("—");
    expect(formatarArea(30.5)).toBe("30,50 m²");
    expect(dadosDe("2026-11-04T09:00:00Z")).toBe(
      "Dados de 04/11/2026 às 06:00",
    );
  });
});
