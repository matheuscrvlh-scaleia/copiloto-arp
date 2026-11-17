import { describe, expect, it } from "vitest";
import { totaisDoPeriodo } from "./rcc";
import {
  cacambasDoMes,
  calcularNotas,
  filtrarNotas,
  type NotaRcc,
  resumoPorMes,
  semPreco,
} from "./rcc-lista";

const nota = (
  id: string,
  competencia: string,
  a: number,
  b: number,
  empresa = "Coletora A",
): NotaRcc => ({
  id,
  competencia,
  empresa,
  numero: id,
  pdf: `rcc/${id}.pdf`,
  cacambasA: a,
  cacambasB: b,
  valorTotal: null,
  exemplo: false,
});

// Padrão do spec: 8 t por caçamba; o fator muda para 7 t em 01/11/2026.
const FATORES = [
  { vigenteDesde: "2000-01-01", toneladasPorCacamba: 8 },
  { vigenteDesde: "2026-11-01", toneladasPorCacamba: 7 },
];
const PRECOS = [{ vigenteDesde: "2000-01-01", precoA: 100, precoB: 400 }];

describe("calcularNotas (spec 8: cálculo do RCC)", () => {
  it("3 caçambas A e 1 B a 8 t: A 24 t, B 8 t, total 32 t, 75% reciclado", () => {
    const [n] = calcularNotas([nota("n1", "2026-10-01", 3, 1)], FATORES, null);
    expect(n).toMatchObject({
      toneladasA: 24,
      toneladasB: 8,
      toneladasTotal: 32,
      pctReciclado: 75,
    });
  });

  it("trocar o fator para 7 t só muda as notas da vigência em diante", () => {
    const [antes, depois] = calcularNotas(
      [nota("n1", "2026-10-01", 3, 1), nota("n2", "2026-11-01", 3, 1)],
      FATORES,
      null,
    );
    expect(antes?.toneladasTotal).toBe(32);
    expect(antes?.fatorDesde).toBe("2000-01-01");
    expect(depois).toMatchObject({
      toneladasA: 21,
      toneladasB: 7,
      toneladasTotal: 28,
      pctReciclado: 75,
      fatorDesde: "2026-11-01",
    });
  });

  it("sem permissão de valores, o valor fica null (não zero)", () => {
    const [n] = calcularNotas([nota("n1", "2026-10-01", 3, 1)], FATORES, null);
    expect(n?.valorEconomizado).toBeNull();
  });

  it("com valores: A × (preço B − preço A), com o preço vigente na competência", () => {
    const [n] = calcularNotas(
      [nota("n1", "2026-10-01", 3, 1)],
      FATORES,
      PRECOS,
    );
    expect(n?.valorEconomizado).toBe(900);
    const [sem] = calcularNotas(
      [nota("n1", "1999-01-01", 3, 1)],
      [{ vigenteDesde: "1990-01-01", toneladasPorCacamba: 8 }],
      PRECOS,
    );
    expect(sem?.valorEconomizado).toBeNull();
  });

  it("sem fator vigente na competência, falha com a mensagem dos Parâmetros", () => {
    expect(() =>
      calcularNotas(
        [nota("n1", "1999-01-01", 1, 0)],
        [{ vigenteDesde: "2000-01-01", toneladasPorCacamba: 8 }],
        null,
      ),
    ).toThrow(/Parâmetros/);
  });
});

describe("filtros, resumo por mês e totais", () => {
  const notas = calcularNotas(
    [
      nota("n1", "2026-09-01", 2, 2),
      nota("n2", "2026-10-01", 3, 1),
      nota("n3", "2026-10-01", 1, 0, "Coletora B"),
      nota("n4", "2025-12-01", 5, 5),
    ],
    FATORES,
    PRECOS,
  );

  it("filtra por ano e empresa", () => {
    expect(filtrarNotas(notas, { ano: 2026, empresa: "" })).toHaveLength(3);
    expect(
      filtrarNotas(notas, { ano: 2026, empresa: "Coletora B" }),
    ).toHaveLength(1);
    expect(filtrarNotas(notas, { ano: 2025, empresa: "" })).toHaveLength(1);
  });

  it("resume por mês com nota, somando as notas do mês (mês sem nota não aparece)", () => {
    const meses = resumoPorMes(filtrarNotas(notas, { ano: 2026, empresa: "" }));
    expect(meses.map((m) => m.competencia)).toEqual([
      "2026-09-01",
      "2026-10-01",
    ]);
    // outubro: 4 A e 1 B = 32 + 8 t, 4 × 8 = 32 t A de 40 t = 80%
    expect(meses[1]).toMatchObject({
      cacambasA: 4,
      cacambasB: 1,
      toneladasA: 32,
      toneladasB: 8,
      total: 40,
      pctReciclado: 80,
      valorEconomizado: 4 * 300,
    });
  });

  it("o % do período é sobre as somas, não a média dos meses", () => {
    const ano = filtrarNotas(notas, { ano: 2026, empresa: "" });
    const t = totaisDoPeriodo(ano);
    // A = 6 × 8 = 48 t, total = 8 × 8 + 1 × 8... = (2+2+3+1+1+0) × 8 = 72 t
    expect(t.toneladasTotal).toBe(72);
    expect(t.pctReciclado).toBeCloseTo((48 / 72) * 100);
    const media =
      resumoPorMes(ano).reduce((s, m) => s + (m.pctReciclado ?? 0), 0) / 2;
    expect(t.pctReciclado).not.toBeCloseTo(media);
  });

  it("conta notas sem preço e as caçambas do mês", () => {
    expect(semPreco(notas)).toBe(0);
    expect(
      semPreco(calcularNotas([nota("x", "2026-10-01", 1, 1)], FATORES, null)),
    ).toBe(1);
    expect(cacambasDoMes(notas, "2026-10-15")).toEqual({ a: 4, b: 1 });
    expect(cacambasDoMes(notas, "2026-11")).toEqual({ a: 0, b: 0 });
  });
});
