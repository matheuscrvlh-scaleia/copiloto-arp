import { describe, expect, it } from "vitest";
import { parteDoDependente } from "./dependentes";

describe("parte do dependente no plano", () => {
  it("empresa não paga: o funcionário paga a faixa inteira", () => {
    expect(parteDoDependente("nao_paga", null, 250.4)).toEqual({
      empresa: 0,
      funcionario: 250.4,
    });
  });

  it("percentual da faixa fica com a empresa", () => {
    expect(parteDoDependente("percentual", 50, 300)).toEqual({
      empresa: 150,
      funcionario: 150,
    });
  });

  it("valor fixo da empresa; o funcionário nunca fica negativo", () => {
    expect(parteDoDependente("valor_fixo", 100, 250)).toEqual({
      empresa: 100,
      funcionario: 150,
    });
    expect(parteDoDependente("valor_fixo", 300, 250).funcionario).toBe(0);
  });

  it("sem mensalidade (sem nascimento ou fora das faixas)", () => {
    expect(parteDoDependente("nao_paga", null, null)).toEqual({
      empresa: 0,
      funcionario: null,
    });
  });
});
