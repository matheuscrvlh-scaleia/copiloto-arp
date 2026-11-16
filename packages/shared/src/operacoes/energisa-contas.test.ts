import { describe, expect, it } from "vitest";
import { lerFaturaEnergisa } from "./energisa";
import { faturaExemplo, itensDaFatura } from "./energisa.fixtures";
import {
  alertasDeConsumo,
  compararComMedia,
  type FaturaConta,
  mediaDaUnidade,
  mesesAte,
  nomeDaUnidade,
  seriePorUnidade,
  somarMeses,
  somarReais,
  totaisDoMes,
  variacaoPct,
} from "./energisa-contas";
import { montarPrevia, resumoSchema } from "./energisa-previa";

function fatura(
  matricula: string,
  referencia: string,
  consumo: number,
  extra: Partial<FaturaConta> = {},
): FaturaConta {
  return {
    id: `${matricula}-${referencia}`,
    matricula,
    referencia,
    vencimento: null,
    medidor: null,
    consumo_kwh: consumo,
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
  };
}

describe("meses", () => {
  it("soma e volta meses atravessando o ano", () => {
    expect(somarMeses("2026-01-01", -1)).toBe("2025-12-01");
    expect(somarMeses("2025-11-01", 14)).toBe("2027-01-01");
    expect(somarMeses("2026-10-01", -12)).toBe("2025-10-01");
  });

  it("lista os meses até o mês, do mais antigo ao mais novo", () => {
    expect(mesesAte("2026-02-01", 3)).toEqual([
      "2025-12-01",
      "2026-01-01",
      "2026-02-01",
    ]);
  });
});

describe("totais do mês", () => {
  it("soma reais por centavos (0,1 + 0,2 = 0,3)", () => {
    expect(somarReais([0.1, 0.2])).toBe(0.3);
    expect(somarReais([332.8, 1849.34, null])).toBe(2182.14);
  });

  it("junta total, kWh, compensação, tributos e saldo", () => {
    const t = totaisDoMes([
      fatura("1", "2026-09-01", 880, {
        total: 332.8,
        compensado_kwh: 780,
        valor_compensado: 887.82,
        icms: 184.11,
        pis_cofins: 9.57,
        iluminacao_publica: 45.33,
        valor_bandeira: 2.74,
        saldo_kwh: 12563,
        expirar_kwh: 0,
      }),
      fatura("2", "2026-09-01", 5316, {
        total: 1849.34,
        compensado_kwh: 5216,
        valor_compensado: 5282.03,
        icms: 1700.64,
        pis_cofins: 9.58,
        iluminacao_publica: 45.33,
        valor_bandeira: 2.75,
        saldo_kwh: 3215,
        expirar_kwh: null,
      }),
    ]);
    expect(t).toEqual({
      faturas: 2,
      total: 2182.14,
      consumoKwh: 6196,
      compensadoKwh: 5996,
      valorCompensado: 6169.85,
      bandeira: 5.49,
      iluminacao: 90.66,
      tributos: 1903.9,
      saldoKwh: 15778,
      expirarKwh: 0,
    });
  });

  it("nome da unidade: apelido ou matrícula", () => {
    expect(nomeDaUnidade("0001", { apelido: " Loja 9 " })).toBe("Loja 9");
    expect(nomeDaUnidade("0001", { apelido: null })).toBe("0001");
    expect(nomeDaUnidade("0001", undefined)).toBe("0001");
  });
});

describe("média e alerta de consumo", () => {
  // 12 meses de 1.000 kWh na unidade A; B só tem 2 meses de histórico.
  const historico = [
    ...mesesAte("2026-08-01", 12).map((m) => fatura("A", m, 1000)),
    fatura("B", "2026-07-01", 400),
    fatura("B", "2026-08-01", 600),
    // Mais de 12 meses antes: fora da média.
    fatura("A", "2025-08-01", 99_999),
  ];
  const doMes = [
    fatura("A", "2026-09-01", 1250),
    fatura("B", "2026-09-01", 590),
  ];
  const todas = [...historico, ...doMes];

  it("média dos 12 meses anteriores, só com os meses que têm fatura", () => {
    expect(mediaDaUnidade(todas, "A", "2026-09-01")).toEqual({
      media: 1000,
      meses: 12,
    });
    expect(mediaDaUnidade(todas, "B", "2026-09-01")).toEqual({
      media: 500,
      meses: 2,
    });
    expect(mediaDaUnidade(todas, "C", "2026-09-01")).toBeNull();
  });

  it("variação: 0 na base não divide", () => {
    expect(variacaoPct(120, 100)).toBe(20);
    expect(variacaoPct(10, 0)).toBeNull();
  });

  it("compara somando as médias de cada unidade", () => {
    const c = compararComMedia(todas, doMes, "2026-09-01");
    expect(c).toEqual({
      atual: 1840,
      media: 1500,
      variacao: (340 / 1500) * 100,
      unidades: 2,
    });
    expect(
      compararComMedia(todas, [fatura("C", "2026-09-01", 9)], "2026-09-01"),
    ).toBeNull();
  });

  it("alerta quem passou da média pelo percentual dos parâmetros", () => {
    expect(alertasDeConsumo(todas, doMes, "2026-09-01", 20)).toEqual([
      { matricula: "A", consumo: 1250, media: 1000, acima: 25 },
    ]);
    // Exatamente no limite não alerta; 25% com limite de 25 também não.
    expect(alertasDeConsumo(todas, doMes, "2026-09-01", 25)).toEqual([]);
  });
});

describe("série do gráfico", () => {
  it("um valor por mês e unidade, null sem fatura", () => {
    const meses = ["2026-07-01", "2026-08-01", "2026-09-01"];
    const s = seriePorUnidade(
      [
        fatura("A", "2026-07-01", 10),
        fatura("A", "2026-09-01", 30),
        fatura("B", "2026-08-01", 5, { compensado_kwh: 4 }),
        fatura("B", "2026-01-01", 99),
      ],
      meses,
      "consumo_kwh",
    );
    expect(Object.fromEntries(s)).toEqual({
      A: [10, null, 30],
      B: [null, 5, null],
    });
  });
});

describe("prévia da importação", () => {
  const lida = lerFaturaEnergisa(
    itensDaFatura(faturaExemplo()),
    "ENERGISAMR-Fat-Matricula-0009100001-09-2026.PDF",
  );
  const base = {
    importacaoId: "00000000-0000-0000-0000-000000000001",
    arquivo: "fatura.pdf",
    fatura: lida,
    unidade: { apelido: "Bloco 1", papel: "consome" as const },
    gravada: true,
    media: { kwh: 800, meses: 12 },
  };

  it("guarda o que foi lido num resumo que passa no schema", () => {
    expect(
      resumoSchema.parse({
        versao: 1,
        matricula: lida.matricula,
        arquivo: "fatura.pdf",
        fatura: lida,
      }).fatura,
    ).toEqual(lida);
  });

  it("matrícula nova pede o cadastro da unidade", () => {
    const p = montarPrevia({ ...base, unidade: null }, 20);
    expect(p.avisos.map((a) => a.mensagem)).toContain(
      "A matrícula 0009100001 ainda não está cadastrada: cadastre a unidade abaixo para seguir.",
    );
  });

  it("consumo acima da média vira aviso (1.020 contra 800 = 27,5%)", () => {
    expect(montarPrevia(base, 20).avisos.map((a) => a.mensagem)).toContain(
      "Consumo 28% acima da média dos 12 meses anteriores (alerta a partir de 20%).",
    );
    expect(montarPrevia(base, 30).avisos).toEqual([]);
  });

  it("leva os números da conferência e os itens", () => {
    const p = montarPrevia(base, 20);
    expect(p).toMatchObject({
      matricula: "0009100001",
      referencia: "2026-09-01",
      total: 34250,
      somaItens: 34250,
      bate: true,
      compensadoKwh: 920,
      gravada: true,
    });
    expect(p.itens).toHaveLength(5);
  });
});
