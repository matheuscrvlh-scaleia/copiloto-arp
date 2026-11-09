import { describe, expect, it } from "vitest";
import { avaliar, lerFormula, type Ref, refsDe } from "./limpeza-formula";

const valores: Record<string, number> = { B26: 315, B27: 8, F3: 10, F7: 2 };
const valorDe = (r: Ref) => valores[`${r.coluna}${r.linha}`] ?? 0;
const conta = (f: string) => {
  const no = lerFormula(f);
  return no ? avaliar(no, valorDe) : undefined;
};

describe("fórmulas da planilha do rateio", () => {
  it("números, %, sinal, parênteses, SUM/SOMA com intervalo", () => {
    expect(conta("5*F3+F7+278.68+3897*2")).toBeCloseTo(50 + 2 + 278.68 + 7794);
    expect(conta("38509.83*4.51%")).toBeCloseTo(1736.793333);
    expect(conta("SUM(B26*B27)")).toBe(2520);
    expect(conta("=+SUM(B26:B27)-F7")).toBe(321);
    expect(conta("SOMA(B26;B27)*(2-1)")).toBe(323);
    expect(conta("-F3/4")).toBe(-2.5);
    expect(conta("$F$3*2")).toBe(20);
  });

  it("referências na ordem, com o intervalo aberto", () => {
    const no = lerFormula("5*F3+SUM(B21:B23)");
    expect(no && refsDe(no).map((r) => `${r.coluna}${r.linha}`)).toEqual([
      "F3",
      "B21",
      "B22",
      "B23",
    ]);
  });

  it("fora do subconjunto: null", () => {
    expect(lerFormula("MAX(B13:B40)")).toBeNull();
    expect(lerFormula("'Outra aba'!F4")).toBeNull();
    expect(lerFormula("F3+")).toBeNull();
    expect(lerFormula("B21:B22")).toBeNull();
    expect(lerFormula("")).toBeNull();
    expect(lerFormula("SUM(A1:Z1000)")).toBeNull();
  });

  it("divisão por zero e célula sem valor: null", () => {
    const no = lerFormula("F3/0");
    expect(no && avaliar(no, valorDe)).toBeNull();
    const semValor = lerFormula("B99*2");
    expect(semValor && avaliar(semValor, () => null)).toBeNull();
  });
});
