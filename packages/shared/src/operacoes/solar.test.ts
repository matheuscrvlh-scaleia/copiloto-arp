import { describe, expect, it } from "vitest";
import type { FaturaConta, Papel } from "./energisa-contas";
import {
  creditosPorOrigem,
  ehFonteSolar,
  geracaoDoMes,
  resumoSolar,
  serieSolar,
  situacaoDaFonte,
} from "./solar";

const f = (
  matricula: string,
  referencia: string,
  extra: Partial<FaturaConta>,
): FaturaConta => ({
  id: `${matricula}-${referencia}`,
  matricula,
  referencia,
  vencimento: null,
  medidor: null,
  consumo_kwh: 0,
  valor_consumo: 0,
  compensado_kwh: 0,
  valor_compensado: 0,
  injetada_kwh: null,
  bandeira: null,
  valor_bandeira: 0,
  iluminacao_publica: 0,
  icms: 0,
  pis_cofins: 0,
  total: 0,
  saldo_kwh: null,
  expirar_kwh: null,
  classificacao_gd: null,
  arquivo: null,
  exemplo: false,
  ...extra,
});

const unidades = new Map<string, { papel: Papel }>([
  ["A", { papel: "consome" }],
  ["B", { papel: "consome" }],
  ["G", { papel: "gera" }],
]);

const setembro = [
  f("A", "2026-09-01", {
    compensado_kwh: 780,
    valor_compensado: 887.82,
    saldo_kwh: 12563,
    expirar_kwh: 0,
  }),
  f("B", "2026-09-01", {
    compensado_kwh: 5216,
    valor_compensado: 5282.03,
    saldo_kwh: 3215,
    expirar_kwh: 120,
  }),
  f("G", "2026-09-01", { injetada_kwh: 6400, compensado_kwh: 280 }),
];

describe("geração", () => {
  it("só com a fonte 'fatura da unidade geradora' e fatura da geradora no mês", () => {
    expect(geracaoDoMes(setembro, unidades, "fatura_geradora")).toBe(6400);
    for (const fonte of ["a_confirmar", "inversor", "planilha"] as const)
      expect(geracaoDoMes(setembro, unidades, fonte)).toBeNull();
    expect(
      geracaoDoMes(setembro.slice(0, 2), unidades, "fatura_geradora"),
    ).toBeNull();
  });

  it("unidade que consome com energia injetada não conta como geração", () => {
    const outra = [f("A", "2026-09-01", { injetada_kwh: 50 })];
    expect(geracaoDoMes(outra, unidades, "fatura_geradora")).toBeNull();
  });

  it("reconhece a fonte dos parâmetros", () => {
    expect(ehFonteSolar("planilha")).toBe(true);
    expect(ehFonteSolar("satelite")).toBe(false);
  });
});

describe("resumo do mês", () => {
  it("compensado, valor, saldo e o que expira no próximo ciclo", () => {
    expect(resumoSolar(setembro, unidades, "a_confirmar")).toEqual({
      geracao: null,
      compensadoKwh: 6276,
      valorCompensado: 6169.85,
      saldoKwh: 15778,
      expirarKwh: 120,
      aExpirar: [{ matricula: "B", kwh: 120 }],
    });
  });
});

describe("série de 12 meses", () => {
  it("geração null sem fonte; compensação null sem fatura no mês", () => {
    const s = serieSolar(
      [...setembro, f("A", "2026-08-01", { compensado_kwh: 700 })],
      ["2026-07-01", "2026-08-01", "2026-09-01"],
      unidades,
      "fatura_geradora",
    );
    expect(s).toEqual({
      geracao: [null, null, 6400],
      compensacao: [null, 700, 6276],
    });
  });
});

describe("créditos por origem", () => {
  it("agrupa por unidade, origem e mês de geração, em positivo", () => {
    expect(
      creditosPorOrigem([
        {
          matricula: "B",
          origem: "mUC",
          mes_geracao: "2026-03-01",
          quantidade: -1016,
          valor: -1028.86,
        },
        {
          matricula: "A",
          origem: "oUC",
          mes_geracao: "2026-09-01",
          quantidade: -707,
          valor: -804.73,
        },
        {
          matricula: "A",
          origem: "mUC",
          mes_geracao: "2024-06-01",
          quantidade: -73,
          valor: -83.09,
        },
        // TE e TUSD do mesmo crédito: somam.
        {
          matricula: "B",
          origem: "oUC",
          mes_geracao: "2026-09-01",
          quantidade: -3253,
          valor: -3000.1,
        },
        {
          matricula: "B",
          origem: "oUC",
          mes_geracao: "2026-09-01",
          quantidade: 0,
          valor: -294.08,
        },
      ]),
    ).toEqual([
      {
        matricula: "A",
        origem: "mUC",
        mesGeracao: "2024-06-01",
        kwh: 73,
        valor: 83.09,
      },
      {
        matricula: "A",
        origem: "oUC",
        mesGeracao: "2026-09-01",
        kwh: 707,
        valor: 804.73,
      },
      {
        matricula: "B",
        origem: "mUC",
        mesGeracao: "2026-03-01",
        kwh: 1016,
        valor: 1028.86,
      },
      {
        matricula: "B",
        origem: "oUC",
        mesGeracao: "2026-09-01",
        kwh: 3253,
        valor: 3294.18,
      },
    ]);
  });
});

describe("de onde vêm os números", () => {
  it("a confirmar: diz que a geração não foi informada e de onde vem o resto", () => {
    const s = situacaoDaFonte("a_confirmar", true, false);
    expect(s.completa).toBe(false);
    expect(s.texto).toMatch(/^Geração das usinas não informada/);
    expect(s.texto).toMatch(/faturas da Energisa/);
  });

  it("fonte escolhida mas não ligada, sem geradora, sem fatura no mês e completa", () => {
    expect(situacaoDaFonte("planilha", true, false).texto).toMatch(
      /planilha mensal\) ainda não está ligada/,
    );
    expect(situacaoDaFonte("fatura_geradora", false, false).texto).toMatch(
      /nenhuma unidade está cadastrada como geradora/,
    );
    expect(situacaoDaFonte("fatura_geradora", true, false).texto).toMatch(
      /não foi importada/,
    );
    expect(situacaoDaFonte("fatura_geradora", true, true).completa).toBe(true);
  });
});
