import { describe, expect, it } from "vitest";
import {
  alertasDaAgua,
  consumoPorBloco,
  DIAS_UTEIS_PADRAO,
  type LeituraPainel,
  mesAnterior,
  ocupacaoPorBloco,
  prazoDoEnvio,
  situacaoDoDiario,
  situacaoDoRateio,
  situacaoFinanceira,
  somaM3,
  totalDoRateio,
} from "./painel";

const leitura = (p: Partial<LeituraPainel>): LeituraPainel => ({
  bloco: "05",
  hidrometro: "H1",
  consumo: 10,
  leitura_anterior: 100,
  leitura_atual: 110,
  foto: "f.jpg",
  ...p,
});

describe("datas", () => {
  it("mês anterior vira o ano em janeiro", () => {
    expect(mesAnterior("2026-01-01")).toBe("2025-12-01");
    expect(mesAnterior("2026-10-01")).toBe("2026-09-01");
  });

  it("prazo do envio: 5º dia útil do mês seguinte, pulando feriado", () => {
    const cal = { feriados: new Set<string>(), diasUteis: DIAS_UTEIS_PADRAO };
    // Outubro/2026 → novembro começa num domingo: 2, 3, 4, 5, 6.
    expect(prazoDoEnvio("2026-10-01", 5, cal)).toBe("2026-11-06");
    const comFeriado = { ...cal, feriados: new Set(["2026-11-02"]) };
    expect(prazoDoEnvio("2026-10-01", 5, comFeriado)).toBe("2026-11-09");
    // Dezembro → janeiro do ano seguinte.
    expect(prazoDoEnvio("2026-12-01", 1, cal)).toBe("2027-01-01");
  });
});

describe("água", () => {
  it("conta leituras com algum alerta e os hidrômetros que sumiram", () => {
    const atual = [
      leitura({ hidrometro: "A", consumo: 31 }),
      leitura({ hidrometro: "B", leitura_atual: 90 }),
      leitura({ hidrometro: "C", leitura_atual: 0, foto: null }),
      leitura({ hidrometro: "D" }),
    ];
    const anterior = [
      leitura({ hidrometro: "A" }),
      leitura({ hidrometro: "X" }),
      leitura({ hidrometro: "X" }),
    ];
    const r = alertasDaAgua(atual, anterior, 30);
    expect(r.porTipo).toEqual({
      limite: 1,
      regressiva: 2,
      sem_foto: 1,
      sumido: 1,
    });
    expect(r.total).toBe(4);
  });

  it("limite é estrito: exatamente no limite não alerta", () => {
    expect(alertasDaAgua([leitura({ consumo: 30 })], [], 30).total).toBe(0);
  });

  it("consumo por bloco soma sem erro de ponto flutuante", () => {
    const r = consumoPorBloco(
      [
        leitura({ bloco: "01", consumo: 0.1 }),
        leitura({ bloco: "01", consumo: 0.2 }),
        leitura({ bloco: "05", consumo: 5 }),
      ],
      [
        leitura({ bloco: "01", consumo: 1 }),
        leitura({ bloco: "09", consumo: 2 }),
      ],
    );
    expect(r).toEqual([
      { bloco: "05", atual: 5, anterior: 0 },
      { bloco: "01", atual: 0.3, anterior: 1 },
      { bloco: "09", atual: 0, anterior: 2 },
    ]);
    expect(somaM3([0.1, "0.2"])).toBe(0.3);
  });
});

describe("energia", () => {
  it("soma os quadros do bloco e calcula a ocupação", () => {
    const r = ocupacaoPorBloco([
      {
        bloco: "09",
        caixas: 10,
        ocupadas: 6,
        reservadas: 1,
        livres: 3,
        semTermo: 1,
      },
      {
        bloco: "09",
        caixas: 10,
        ocupadas: 2,
        reservadas: 0,
        livres: 8,
        semTermo: 0,
      },
      {
        bloco: "01",
        caixas: 0,
        ocupadas: 0,
        reservadas: 0,
        livres: 0,
        semTermo: 0,
      },
    ]);
    expect(
      r.map((b) => [b.bloco, b.caixas, b.ocupadas, b.ocupacaoPct]),
    ).toEqual([
      ["01", 0, 0, null],
      ["09", 20, 8, 40],
    ]);
  });
});

describe("limpeza", () => {
  it("reproduz o total de setembro de 2026 (spec 4.8): 57.783,61", () => {
    expect(
      totalDoRateio({
        valorBase: 35323.94,
        funcBase: 9,
        funcAreaComum: 5,
        funcRateados: 4,
        extras: [278.68, 15588, 2520, 2497.99, 1575],
      }),
    ).toBe(5_778_361);
  });

  it("sem valor base ou funcionários não calcula", () => {
    expect(
      totalDoRateio({
        valorBase: null,
        funcBase: 9,
        funcAreaComum: 5,
        funcRateados: 4,
        extras: [],
      }),
    ).toBeNull();
  });

  it("situação: enviado vence tudo; passou do prazo sem envio é alerta", () => {
    const base = {
      status: "fechado" as const,
      incompleto: false,
      enviado: false,
      prazo: "2026-11-06",
      hoje: "2026-11-05",
    };
    expect(situacaoDoRateio(base)).toBe("fechado");
    expect(situacaoDoRateio({ ...base, hoje: "2026-11-07" })).toBe("atrasado");
    expect(
      situacaoDoRateio({ ...base, hoje: "2026-11-07", enviado: true }),
    ).toBe("enviado");
    expect(
      situacaoDoRateio({ ...base, status: "aberto", incompleto: true }),
    ).toBe("incompleto");
  });
});

describe("obras", () => {
  it("saldo, índice e desvio do realizado contra o previsto", () => {
    const r = situacaoFinanceira(
      {
        orcamentoCentavos: 100_000_00,
        previstoAteCentavos: 40_000_00,
        realizadoCentavos: 46_000_00,
      },
      10,
    );
    expect(r.saldoCentavos).toBe(54_000_00);
    expect(r.desvioPct).toBeCloseTo(15);
    expect(r.indice).toBeCloseTo(1.15);
    expect(r.alerta).toBe(true);
  });

  it("Diário: desvio em pontos, prazo vencido e paralisada viram alerta", () => {
    const obra = {
      status_id: 3,
      realizado: 40,
      prazo_contratual: 100,
      prazo_decorrido: 60,
      prazo_a_vencer: 40,
      data_fim: "2027-01-31",
    };
    const r = situacaoDoDiario(obra, "2026-11-09", -10);
    expect(r.desvio).toBe(-20);
    expect(r.alerta).toBe(true);
    expect(r.vencido).toBe(false);
    expect(
      situacaoDoDiario({ ...obra, realizado: 55 }, "2026-11-09", -10).alerta,
    ).toBe(false);
    expect(
      situacaoDoDiario({ ...obra, prazo_a_vencer: 0 }, "2026-11-09", -10)
        .vencido,
    ).toBe(true);
    expect(
      situacaoDoDiario(
        { ...obra, status_id: 4, prazo_a_vencer: 0, realizado: 10 },
        "2026-11-09",
        -10,
      ).alerta,
    ).toBe(false);
    expect(
      situacaoDoDiario(
        { ...obra, status_id: 2, realizado: 60 },
        "2026-11-09",
        -10,
      ).alerta,
    ).toBe(true);
  });
});
