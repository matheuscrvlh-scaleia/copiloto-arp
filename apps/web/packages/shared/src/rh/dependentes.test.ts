import { describe, expect, it } from "vitest";
import { parteDoDependente, titularRecebe, valeNoMes } from "./dependentes";

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

describe("titular recebe o benefício no mês", () => {
  const mes = "2026-10-01";
  const titular = { colaborador_id: "c1", tipo_contrato: "clt" };

  it("vale no mês: começou até o fim dele e não acabou antes", () => {
    expect(valeNoMes({ desde: "2026-10-20", ate: null }, mes)).toBe(true);
    expect(valeNoMes({ desde: "2026-11-01", ate: null }, mes)).toBe(false);
    expect(valeNoMes({ desde: "2026-01-01", ate: "2026-10-05" }, mes)).toBe(
      true,
    );
    expect(valeNoMes({ desde: "2026-01-01", ate: "2026-09-30" }, mes)).toBe(
      false,
    );
  });

  it("pela pessoa ou pelo tipo de contrato", () => {
    expect(
      titularRecebe(
        titular,
        [{ colaborador_id: "c1", desde: "2026-01-01", ate: null }],
        [],
        mes,
      ),
    ).toBe(true);
    expect(
      titularRecebe(
        titular,
        [],
        [{ tipo_contrato: "clt", desde: "2026-01-01", ate: null }],
        mes,
      ),
    ).toBe(true);
  });

  it("sem vínculo, com o de outra pessoa ou de outro contrato: não recebe", () => {
    expect(
      titularRecebe(
        titular,
        [{ colaborador_id: "c2", desde: "2026-01-01", ate: null }],
        [{ tipo_contrato: "pj", desde: "2026-01-01", ate: null }],
        mes,
      ),
    ).toBe(false);
    expect(
      titularRecebe({ ...titular, tipo_contrato: null }, [], [], mes),
    ).toBe(false);
  });
});
