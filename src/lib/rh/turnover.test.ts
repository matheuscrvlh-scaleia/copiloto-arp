import { describe, expect, it } from "vitest";
import {
  avaliarFormula,
  FORMULA_GERAL_PADRAO,
  TURNOVER_PADRAO,
  taxasDeTurnover,
  tipoDoDesligamento,
} from "./turnover";

const vars = {
  total_colaboradores_inicio_mes: 40,
  desligamentos_voluntarios: 2,
  desligamentos_involuntarios: 1,
  desligamentos_acordo: 1,
  admissoes: 3,
};

describe("fórmulas de turnover (as do Copiloto)", () => {
  it("avalia a fórmula padrão", () => {
    expect(avaliarFormula(FORMULA_GERAL_PADRAO, vars)).toBe(10);
  });

  it("aceita outras fórmulas com as cinco variáveis", () => {
    expect(
      avaliarFormula(
        "((admissoes + desligamentos_voluntarios + desligamentos_involuntarios) / 2) / total_colaboradores_inicio_mes * 100",
        vars,
      ),
    ).toBe(7.5);
    expect(avaliarFormula("-admissoes + 10 % 4", vars)).toBe(-1);
  });

  it("recusa variável desconhecida, código e sintaxe quebrada", () => {
    expect(avaliarFormula("salario * 2", vars)).toBeNull();
    expect(avaliarFormula("alert(1)", vars)).toBeNull();
    expect(avaliarFormula("(admissoes", vars)).toBeNull();
    expect(avaliarFormula("", vars)).toBeNull();
  });

  it("divisão por zero vale 0", () => {
    expect(
      avaliarFormula(FORMULA_GERAL_PADRAO, {
        ...vars,
        total_colaboradores_inicio_mes: 0,
      }),
    ).toBe(0);
  });

  it("fórmula inválida na configuração cai na geral padrão", () => {
    const [geral] = taxasDeTurnover(
      40,
      3,
      { voluntario: 2, involuntario: 1, acordo: 1 },
      { ...TURNOVER_PADRAO, formulaGeral: "isso não é fórmula" },
    );
    expect(geral?.valor).toBe(10);
  });
});

describe("classificação do desligamento (como no Copiloto)", () => {
  it("motivo da lista de voluntários é voluntário; o resto, involuntário", () => {
    expect(tipoDoDesligamento("pedido_demissao", TURNOVER_PADRAO)).toBe(
      "voluntario",
    );
    expect(tipoDoDesligamento("aposentadoria_idade", TURNOVER_PADRAO)).toBe(
      "voluntario",
    );
    expect(tipoDoDesligamento("justa_causa", TURNOVER_PADRAO)).toBe(
      "involuntario",
    );
    expect(tipoDoDesligamento("falecimento", TURNOVER_PADRAO)).toBe(
      "involuntario",
    );
    expect(tipoDoDesligamento(null, TURNOVER_PADRAO)).toBe("involuntario");
  });

  it("acordo mútuo segue a configuração", () => {
    expect(tipoDoDesligamento("acordo_mutuo", TURNOVER_PADRAO)).toBe(
      "voluntario",
    );
    expect(
      tipoDoDesligamento("acordo_mutuo", {
        ...TURNOVER_PADRAO,
        acordoContaComo: "involuntario",
      }),
    ).toBe("involuntario");
    expect(
      tipoDoDesligamento("acordo_mutuo", {
        ...TURNOVER_PADRAO,
        acordoContaComo: "separado",
      }),
    ).toBe("acordo");
  });
});
