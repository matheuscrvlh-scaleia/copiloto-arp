import { describe, expect, it } from "vitest";
import {
  indiceDeRetorno,
  participacaoDaFolha,
  receitaDoPeriodo,
  receitaPorColaborador,
  sobreReceita,
} from "./retorno";

describe("receitaDoPeriodo", () => {
  it("soma o faturamento lançado de todos os meses", () => {
    expect(receitaDoPeriodo([100_000, 50_000], 30_000, 10)).toEqual({
      valor: 150_000,
      ilustrativa: false,
    });
  });

  it("sem o faturamento de algum mês, usa o que deixaria o custo na meta", () => {
    expect(receitaDoPeriodo([100_000, null], 30_000, 10)).toEqual({
      valor: 300_000,
      ilustrativa: true,
    });
    expect(receitaDoPeriodo([], 30_000, 40)).toEqual({
      valor: 75_000,
      ilustrativa: true,
    });
  });

  it("faturamento zerado conta como não lançado", () => {
    expect(receitaDoPeriodo([0], 30_000, 10)?.ilustrativa).toBe(true);
  });

  it("sem faturamento e sem meta não há valor", () => {
    expect(receitaDoPeriodo([null], 30_000, null)).toBeNull();
    expect(receitaDoPeriodo([null], 0, 10)).toBeNull();
  });
});

describe("indicadores de retorno", () => {
  it("% sobre a receita", () => {
    expect(sobreReceita(25_000, 200_000)).toBe(12.5);
    expect(sobreReceita(25_000, 0)).toBeNull();
  });

  it("receita por colaborador e índice de retorno", () => {
    const porPessoa = receitaPorColaborador(200_000, 40);
    expect(porPessoa).toBe(5_000);
    expect(indiceDeRetorno(porPessoa, 2_000)).toBe(2.5);
    expect(receitaPorColaborador(200_000, 0)).toBeNull();
    expect(indiceDeRetorno(null, 2_000)).toBeNull();
    expect(indiceDeRetorno(5_000, null)).toBeNull();
  });

  it("participação da folha no custo total exige todos os meses", () => {
    expect(participacaoDaFolha(30_000, [60_000, 40_000])).toBe(30);
    expect(participacaoDaFolha(30_000, [60_000, null])).toBeNull();
    expect(participacaoDaFolha(30_000, [])).toBeNull();
  });
});
