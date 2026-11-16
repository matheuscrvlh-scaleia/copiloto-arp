import { describe, expect, it } from "vitest";
import {
  ErroPlanilha,
  faixasDoFormulario,
  lerTabelaDoPlano,
  mesesDoTexto,
  numeroDaCelula,
  periodoEmMeses,
} from "./plano";

// Planilha sintética no formato da operadora (valores inventados).
const FAIXAS = {
  sheet: "Faixas etárias",
  data: [
    ["Idade Inicio", "Idade Final", "Valor Mensalidade"],
    [0, 18, 100],
    [19, 23, 150.5],
    [24, 999, "1.234,56"],
  ],
};
const COPART = {
  sheet: "Regras de coparticipação",
  data: [
    ["Período", "Percentual pago pelo colaborador", "Observações"],
    ["De 3 meses até 2 anos completos", "50%", null],
    ["De 2 anos e 1 mês até 3 anos completos", "40%", null],
    [
      "A partir de 3 anos e 1 mês",
      "100%",
      "Desconto em folha de pagamento de R$ 40,00 atualmente.",
    ],
  ],
};

describe("tabela do plano", () => {
  it("lê faixas, 999 vira sem limite, e números em pt-BR", () => {
    const t = lerTabelaDoPlano([FAIXAS, COPART]);
    expect(t.faixas).toEqual([
      { idade_min: 0, idade_max: 18, mensalidade: 100 },
      { idade_min: 19, idade_max: 23, mensalidade: 150.5 },
      { idade_min: 24, idade_max: null, mensalidade: 1234.56 },
    ]);
  });

  it("período em texto vira meses; valor fixo da observação vence o %", () => {
    const t = lerTabelaDoPlano([FAIXAS, COPART]);
    expect(t.coparticipacao.map(({ periodo: _, ...r }) => r)).toEqual([
      {
        meses_min: 3,
        meses_max: 24,
        colaborador_pct: 50,
        colaborador_valor_fixo: null,
      },
      {
        meses_min: 25,
        meses_max: 36,
        colaborador_pct: 40,
        colaborador_valor_fixo: null,
      },
      {
        meses_min: 37,
        meses_max: null,
        colaborador_pct: null,
        colaborador_valor_fixo: 40,
      },
    ]);
    expect(t.avisos.join(" ")).toMatch(/valor fixo de R\$ 40,00/);
  });

  it("acha as abas pelo nome, sem depender de acento ou maiúscula", () => {
    const t = lerTabelaDoPlano([
      { ...COPART, sheet: "REGRAS DE COPARTICIPACAO" },
      { ...FAIXAS, sheet: "faixas etarias" },
    ]);
    expect(t.faixas).toHaveLength(3);
    expect(t.coparticipacao).toHaveLength(3);
  });

  it("sem coparticipação grava só as faixas, com aviso", () => {
    const t = lerTabelaDoPlano([FAIXAS]);
    expect(t.coparticipacao).toEqual([]);
    expect(t.avisos[0]).toMatch(/só as faixas/);
  });

  it("recusa planilha errada ou faixas sobrepostas, avisa buraco", () => {
    expect(() => lerTabelaDoPlano([{ sheet: "Plan1", data: [] }])).toThrow(
      ErroPlanilha,
    );
    expect(() =>
      lerTabelaDoPlano([
        {
          sheet: "Faixas",
          data: [
            [0, 20, 1],
            [18, 30, 2],
          ],
        },
      ]),
    ).toThrow(/sobrepostas/);
    const buraco = lerTabelaDoPlano([
      {
        sheet: "Faixas",
        data: [
          [0, 18, 1],
          [24, 30, 2],
        ],
      },
    ]);
    expect(buraco.avisos[0]).toMatch(/19 a 23/);
  });

  it("faixas editadas na tela: ignora linha vazia, idade final vazia é sem limite", () => {
    const vazia = { idade_min: "", idade_max: "", mensalidade: "" };
    const t = faixasDoFormulario([
      { idade_min: "19", idade_max: "", mensalidade: "1.535,58" },
      vazia,
      { idade_min: " 0 ", idade_max: "18", mensalidade: "256,36" },
    ]);
    expect(t.faixas).toEqual([
      { idade_min: 0, idade_max: 18, mensalidade: 256.36 },
      { idade_min: 19, idade_max: null, mensalidade: 1535.58 },
    ]);
    expect(t.avisos).toEqual([]);

    expect(() => faixasDoFormulario([vazia])).toThrow(/ao menos uma/);
    expect(() =>
      faixasDoFormulario([
        { idade_min: "10", idade_max: "5", mensalidade: "1" },
      ]),
    ).toThrow(/Linha 1: a idade final é menor/);
    expect(() =>
      faixasDoFormulario([
        vazia,
        { idade_min: "0", idade_max: "18", mensalidade: "abc" },
      ]),
    ).toThrow(/Linha 2: informe a mensalidade/);
    expect(() =>
      faixasDoFormulario([
        { idade_min: "0", idade_max: "", mensalidade: "1" },
        { idade_min: "30", idade_max: "40", mensalidade: "2" },
      ]),
    ).toThrow(/sobrepostas/);
  });

  it("apoio: números e meses", () => {
    expect(numeroDaCelula("R$ 57,50")).toBe(57.5);
    expect(numeroDaCelula("50%")).toBe(50);
    expect(numeroDaCelula("abc")).toBeNull();
    expect(mesesDoTexto("2 anos e 1 mês")).toBe(25);
    expect(mesesDoTexto("3 meses")).toBe(3);
    expect(periodoEmMeses("De 5 anos e 1 mês até 7 anos completos")).toEqual({
      min: 61,
      max: 84,
    });
  });
});
