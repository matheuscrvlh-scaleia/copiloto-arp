import { describe, expect, it } from "vitest";
import {
  ateNoMaximo,
  competenciasDoPeriodo,
  dataValida,
  descreverPeriodo,
  diasNoPeriodo,
  lerPeriodo,
  periodoAnterior,
  periodoDoAtalho,
} from "./periodo";

// Terça-feira, 21/10/2026.
const HOJE = new Date(2026, 9, 21);

describe("período das telas", () => {
  it("atalhos", () => {
    expect(periodoDoAtalho("hoje", HOJE)).toMatchObject({
      de: "2026-10-21",
      ate: "2026-10-21",
    });
    expect(periodoDoAtalho("ontem", HOJE)).toMatchObject({
      de: "2026-10-20",
      ate: "2026-10-20",
    });
    // Semana começa na segunda.
    expect(periodoDoAtalho("semana", HOJE)).toMatchObject({
      de: "2026-10-19",
      ate: "2026-10-21",
    });
    expect(periodoDoAtalho("semana", new Date(2026, 9, 25))).toMatchObject({
      de: "2026-10-19",
      ate: "2026-10-25",
    });
    expect(periodoDoAtalho("mes", HOJE)).toMatchObject({
      de: "2026-10-01",
      ate: "2026-10-21",
    });
    expect(periodoDoAtalho("mes_passado", HOJE)).toMatchObject({
      de: "2026-09-01",
      ate: "2026-09-30",
    });
  });

  it("lê a URL sem confiar nela", () => {
    expect(lerPeriodo({ periodo: "ontem" }, HOJE).atalho).toBe("ontem");
    expect(lerPeriodo({ de: "2026-10-15", ate: "2026-10-01" }, HOJE)).toEqual({
      de: "2026-10-01",
      ate: "2026-10-15",
      atalho: null,
    });
    expect(lerPeriodo({ mes: "2026-07" }, HOJE)).toEqual({
      de: "2026-07-01",
      ate: "2026-07-31",
      atalho: null,
    });
    // Lixo: vale o padrão (este mês).
    expect(lerPeriodo({ de: "2026-02-31", periodo: "x" }, HOJE).atalho).toBe(
      "mes",
    );
    expect(dataValida("2026-02-29")).toBe(false);
    expect(dataValida("2028-02-29")).toBe(true);
  });

  it("nada no futuro", () => {
    const p = lerPeriodo({ de: "2026-10-10", ate: "2026-12-31" }, HOJE);
    expect(ateNoMaximo(p, "2026-10-21").ate).toBe("2026-10-21");
  });

  it("meses que o período toca e quantos dias tem", () => {
    expect(
      competenciasDoPeriodo({ de: "2026-08-20", ate: "2026-10-05" }),
    ).toEqual(["2026-08-01", "2026-09-01", "2026-10-01"]);
    expect(diasNoPeriodo({ de: "2026-10-01", ate: "2026-10-21" })).toBe(21);
  });

  it("período anterior", () => {
    // Meses inteiros: os mesmos meses antes.
    expect(
      periodoAnterior({ de: "2026-07-01", ate: "2026-09-30", atalho: null }),
    ).toMatchObject({ de: "2026-04-01", ate: "2026-06-30" });
    // Este mês até hoje: o mesmo trecho do mês passado.
    expect(periodoAnterior(periodoDoAtalho("mes", HOJE))).toMatchObject({
      de: "2026-09-01",
      ate: "2026-09-21",
    });
    // Dias soltos: os mesmos tantos dias antes.
    expect(periodoAnterior(periodoDoAtalho("semana", HOJE))).toMatchObject({
      de: "2026-10-16",
      ate: "2026-10-18",
    });
  });

  it("descrição", () => {
    expect(descreverPeriodo(periodoDoAtalho("hoje", HOJE))).toBe(
      "Hoje (21/10/2026)",
    );
    expect(
      descreverPeriodo({ de: "2026-09-01", ate: "2026-09-30", atalho: null }),
    ).toBe("set/2026");
    expect(
      descreverPeriodo({ de: "2026-07-01", ate: "2026-09-30", atalho: null }),
    ).toBe("jul/2026 a set/2026");
    expect(descreverPeriodo(periodoDoAtalho("mes", HOJE))).toBe(
      "01/10/2026 a 21/10/2026",
    );
  });
});
