import { describe, expect, it } from "vitest";
import { DURACAO_MAXIMA_MS, INATIVIDADE_MS, sessaoVencida } from "./sessao";

const SUB = "6f1c2c1e-1111-4222-8333-944455556666";
const T0 = 1_800_000_000_000;

describe("sessaoVencida", () => {
  const p = { sub: SUB, inicio: T0, ultima: T0 };

  it("vale dentro do prazo", () => {
    expect(sessaoVencida(p, SUB, T0 + INATIVIDADE_MS)).toBe(false);
  });

  it("vence após 30 min parada", () => {
    expect(sessaoVencida(p, SUB, T0 + INATIVIDADE_MS + 1)).toBe(true);
  });

  it("vence após 8h mesmo em uso", () => {
    const agora = T0 + DURACAO_MAXIMA_MS + 1;
    expect(sessaoVencida({ ...p, ultima: agora - 1000 }, SUB, agora)).toBe(
      true,
    );
  });

  it("vence sem prazo ou com prazo de outra pessoa", () => {
    expect(sessaoVencida(null, SUB, T0)).toBe(true);
    expect(sessaoVencida(p, "outra", T0)).toBe(true);
  });
});
