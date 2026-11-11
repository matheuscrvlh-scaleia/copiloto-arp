import { describe, expect, it } from "vitest";
import {
  anoEmUso,
  filtrarGastos,
  mesesDoAno,
  porCategoria,
  soma,
} from "./orcamento";

const g = (data: string, valor: number, categoria_id = "eventos") => ({
  id: `${data}-${valor}`,
  data,
  valor,
  categoria_id,
  categoria: categoria_id === "eventos" ? "Eventos" : "Brindes",
  descricao: "x",
  finalidade: "y",
  observacao: null,
});

const GASTOS = [
  g("2026-01-10", 1000),
  g("2026-01-20", 500.1, "brindes"),
  g("2026-03-05", 2000),
  g("2025-12-31", 9999),
];

describe("planejamento orçamentário", () => {
  it("cada gasto abate do orçamento do ano da sua data, mês a mês", () => {
    const meses = mesesDoAno(2026, GASTOS, 10_000);
    expect(meses).toHaveLength(12);
    expect(meses[0]).toMatchObject({
      competencia: "2026-01-01",
      gasto: 1500.1,
      acumulado: 1500.1,
      saldo: 8499.9,
    });
    expect(meses[1]).toMatchObject({ gasto: 0, acumulado: 1500.1 });
    expect(meses[2]).toMatchObject({ gasto: 2000, saldo: 6499.9 });
    expect(meses[11]?.consumidoPct).toBeCloseTo(35.001, 3);
  });

  it("saldo negativo quando passa do orçamento; sem orçamento, sem saldo", () => {
    expect(mesesDoAno(2026, GASTOS, 3000)[2]?.saldo).toBe(-500.1);
    const sem = mesesDoAno(2026, GASTOS, null)[0];
    expect(sem?.saldo).toBeNull();
    expect(sem?.consumidoPct).toBeNull();
  });

  it("totais por categoria, do maior para o menor", () => {
    expect(porCategoria(GASTOS.slice(0, 3))).toEqual([
      {
        categoria_id: "eventos",
        categoria: "Eventos",
        total: 3000,
        lancamentos: 2,
      },
      {
        categoria_id: "brindes",
        categoria: "Brindes",
        total: 500.1,
        lancamentos: 1,
      },
    ]);
  });

  it("filtro por mês e por categoria", () => {
    const doAno = GASTOS.slice(0, 3);
    expect(soma(filtrarGastos(doAno, { mes: 1, categoria: null }))).toBe(
      1500.1,
    );
    expect(
      soma(filtrarGastos(doAno, { mes: null, categoria: "eventos" })),
    ).toBe(3000);
    expect(filtrarGastos(doAno, { mes: 2, categoria: null })).toEqual([]);
  });

  it("ano em uso: o corrente ou, finalizado, o seguinte", () => {
    expect(anoEmUso(2026, [])).toBe(2026);
    expect(anoEmUso(2026, [2025])).toBe(2026);
    expect(anoEmUso(2026, [2026])).toBe(2027);
    expect(anoEmUso(2026, [2026, 2027])).toBe(2028);
  });
});
