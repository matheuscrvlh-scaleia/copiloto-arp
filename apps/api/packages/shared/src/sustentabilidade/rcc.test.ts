import { describe, expect, it } from "vitest";
import { calcularNota, fatorVigente, totaisDoPeriodo } from "./rcc";

// Padrão do spec (4.7): 8 t por caçamba de 5 m³. No sistema vem dos Parâmetros.
const FATORES = [
  { vigenteDesde: "2020-01-01", toneladasPorCacamba: 8 },
  { vigenteDesde: "2026-11-01", toneladasPorCacamba: 7 },
];

describe("calcularNota (spec 8)", () => {
  it("3 A + 1 B, 8 t → 24 / 8 / 32 t, 75% reciclado", () => {
    expect(
      calcularNota(
        { cacambasA: 3, cacambasB: 1 },
        { toneladasPorCacamba: 8 },
        null,
      ),
    ).toEqual({
      toneladasA: 24,
      toneladasB: 8,
      toneladasTotal: 32,
      pctReciclado: 75,
      valorEconomizado: null,
    });
  });

  it("valor economizado = A × (preço B − preço A)", () => {
    expect(
      calcularNota(
        { cacambasA: 3, cacambasB: 1 },
        { toneladasPorCacamba: 8 },
        { precoA: 300, precoB: 750.5 },
      ).valorEconomizado,
    ).toBe(1351.5);
  });

  it("sem caçamba: % null, não zero", () => {
    expect(
      calcularNota(
        { cacambasA: 0, cacambasB: 0 },
        { toneladasPorCacamba: 8 },
        null,
      ).pctReciclado,
    ).toBeNull();
  });
});

describe("fatorVigente", () => {
  it("trocar para 7 t muda só as notas da nova vigência em diante", () => {
    const nota = { cacambasA: 3, cacambasB: 1 };
    const out = fatorVigente(FATORES, "2026-10-01");
    const nov = fatorVigente(FATORES, "2026-11-01");
    expect(out?.toneladasPorCacamba).toBe(8);
    expect(nov?.toneladasPorCacamba).toBe(7);
    expect(
      calcularNota(nota, out ?? { toneladasPorCacamba: 0 }, null)
        .toneladasTotal,
    ).toBe(32);
    expect(
      calcularNota(nota, nov ?? { toneladasPorCacamba: 0 }, null)
        .toneladasTotal,
    ).toBe(28);
  });

  it("vigência no meio do mês vale a partir do mês seguinte; antes de tudo, null", () => {
    const lista = [
      { vigenteDesde: "2026-11-15", toneladasPorCacamba: 7 },
      { vigenteDesde: "2020-01-01", toneladasPorCacamba: 8 },
    ];
    expect(fatorVigente(lista, "2026-11-01")?.toneladasPorCacamba).toBe(8);
    expect(fatorVigente(lista, "2026-12-01")?.toneladasPorCacamba).toBe(7);
    expect(fatorVigente(lista, "2019-12-01")).toBeNull();
  });
});

describe("totaisDoPeriodo", () => {
  const precos = { precoA: 100, precoB: 400 };
  const f = { toneladasPorCacamba: 8 };
  const nota = (a: number, b: number, p: typeof precos | null = precos) => ({
    cacambasA: a,
    cacambasB: b,
    ...calcularNota({ cacambasA: a, cacambasB: b }, f, p),
  });

  it("% do período sobre as somas, não média dos meses", () => {
    // Mês 1: 1 A + 0 B = 100%; mês 2: 1 A + 3 B = 25%. Média seria 62,5%.
    const t = totaisDoPeriodo([nota(1, 0), nota(1, 3)]);
    expect(t.cacambasA).toBe(2);
    expect(t.cacambasB).toBe(3);
    expect(t.toneladasTotal).toBe(40);
    expect(t.pctReciclado).toBe(40);
    expect(t.valorEconomizado).toBe(600);
  });

  it("valor null se alguma nota não tem valor; período vazio sem %", () => {
    expect(
      totaisDoPeriodo([nota(1, 0), nota(1, 0, null)]).valorEconomizado,
    ).toBeNull();
    const vazio = totaisDoPeriodo([]);
    expect(vazio.toneladasTotal).toBe(0);
    expect(vazio.pctReciclado).toBeNull();
  });
});
