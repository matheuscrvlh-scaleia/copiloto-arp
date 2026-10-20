import { describe, expect, it } from "vitest";
import {
  competenciaDaUrl,
  fimDoMes,
  formatarData,
  formatarHoras,
  formatarMes,
  formatarMoeda,
  formatarPct,
  ultimasCompetencias,
} from "./formato";
import { metaVigente, status } from "./indicadores";

describe("formato", () => {
  it("horas a partir de minutos", () => {
    expect(formatarHoras(750)).toBe("12h30");
    expect(formatarHoras(-8460)).toBe("-141h00");
    expect(formatarHoras(74_100)).toBe("1.235h00");
    expect(formatarHoras(0)).toBe("0h00");
  });

  it("percentual, mês e data em pt-BR", () => {
    expect(formatarPct(6.523)).toBe("6,5%");
    expect(formatarPct(null)).toBe("—");
    expect(formatarMoeda(1234.5)).toBe("R$ 1.234,50");
    expect(formatarMoeda(1234.5, 0)).toBe("R$ 1.235");
    expect(formatarMoeda(null)).toBe("—");
    expect(formatarMes("2026-10-01")).toBe("out/2026");
    expect(formatarData("2026-10-19")).toBe("19/10/2026");
  });

  it("competência da URL só aceita aaaa-mm válido", () => {
    expect(competenciaDaUrl("2026-09")).toBe("2026-09-01");
    expect(competenciaDaUrl("2026-13")).toBeNull();
    expect(competenciaDaUrl("x")).toBeNull();
    expect(competenciaDaUrl(undefined)).toBeNull();
  });

  it("últimas competências atravessam o ano", () => {
    expect(ultimasCompetencias("2026-02-01", 3)).toEqual([
      "2025-12-01",
      "2026-01-01",
      "2026-02-01",
    ]);
    expect(fimDoMes("2026-02-01")).toBe("2026-02-28");
  });
});

describe("semáforo", () => {
  const menor = {
    meta: 10,
    limiteAtencao: 12,
    direcao: "menor_melhor" as const,
  };

  it("menor é melhor: Ok, Atenção e Fora", () => {
    expect(status(9, menor)).toBe("ok");
    expect(status(10, menor)).toBe("ok");
    expect(status(11, menor)).toBe("atencao");
    expect(status(13, menor)).toBe("fora");
  });

  it("sem faixa de atenção vai direto para Fora", () => {
    expect(status(11, { ...menor, limiteAtencao: null })).toBe("fora");
  });

  it("maior é melhor é o espelho", () => {
    const maior = {
      meta: 50,
      limiteAtencao: 40,
      direcao: "maior_melhor" as const,
    };
    expect(status(55, maior)).toBe("ok");
    expect(status(45, maior)).toBe("atencao");
    expect(status(30, maior)).toBe("fora");
  });

  it("sem meta ou sem dado", () => {
    expect(status(5, null)).toBe("sem_meta");
    expect(status(null, menor)).toBe("sem_dado");
  });

  it("meta vigente é a mais recente até a competência", () => {
    const metas = [
      { indicador: "rh.absenteismo", vigente_desde: "2026-01-01", meta: 3 },
      { indicador: "rh.absenteismo", vigente_desde: "2026-09-01", meta: 4 },
    ];
    expect(metaVigente(metas, "rh.absenteismo", "2026-08-01")?.meta).toBe(3);
    expect(metaVigente(metas, "rh.absenteismo", "2026-10-01")?.meta).toBe(4);
    expect(metaVigente(metas, "rh.turnover", "2026-10-01")).toBeNull();
  });
});

describe("formatarDataHora", () => {
  it("mostra no horário de Brasília", async () => {
    const { formatarDataHora } = await import("./formato");
    expect(formatarDataHora("2026-10-20T13:05:00+00:00")).toBe(
      "20/10/2026 10:05",
    );
  });
});
