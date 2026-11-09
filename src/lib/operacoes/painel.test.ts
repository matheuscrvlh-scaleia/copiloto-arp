import { describe, expect, it } from "vitest";
import {
  alertasDaLeitura,
  type LeituraParaAlerta,
  type ParametrosAlerta,
  sumidos,
} from "./agua-alertas";
import { linhasDoPainel, type ObraDoDiario } from "./diario";
import { situacaoDoEnvio } from "./limpeza";
import {
  consumoPorBloco,
  mesAnterior,
  ocupacaoPorBloco,
  resumoDoDiario,
  resumoDosAlertas,
  situacaoDoRateio,
  situacaoFinanceira,
  somaM3,
} from "./painel";

describe("datas", () => {
  it("mês anterior vira o ano em janeiro", () => {
    expect(mesAnterior("2026-01-01")).toBe("2025-12-01");
    expect(mesAnterior("2026-10-01")).toBe("2026-09-01");
  });
});

describe("água", () => {
  const parametros: ParametrosAlerta = {
    limiteM3: 30,
    variacaoPct: 50,
    variacaoMeses: 3,
    variacaoMinM3: 5,
  };
  const leitura = (p: Partial<LeituraParaAlerta>): LeituraParaAlerta => ({
    hidrometro: "H1",
    referencia: "2026-10-01",
    cliente: "Loja Exemplo",
    leituraAnterior: 100,
    leituraAtual: 110,
    consumo: 10,
    temFoto: true,
    ...p,
  });
  const comAlertas = (l: LeituraParaAlerta) => ({
    alertas: alertasDaLeitura(l, { parametros, historico: [], enet: null }),
  });

  it("soma os alertas que a regra da tela de Água calculou", () => {
    const leituras = [
      comAlertas(leitura({ hidrometro: "A", consumo: 31 })),
      comAlertas(leitura({ hidrometro: "B", leituraAtual: 90 })),
      comAlertas(leitura({ hidrometro: "C", temFoto: false, consumo: 40 })),
      comAlertas(leitura({ hidrometro: "D" })),
      // Zerada sem leitura anterior: a tela não chama de regressiva.
      comAlertas(
        leitura({ hidrometro: "E", leituraAnterior: null, leituraAtual: 0 }),
      ),
    ];
    const foram = sumidos(
      [{ hidrometro: "A" }, { hidrometro: "X" }, { hidrometro: "X" }],
      ["A", "B", "C", "D", "E"],
    );
    const r = resumoDosAlertas(leituras, foram.length);
    expect(r.porTipo.limite).toBe(2);
    expect(r.porTipo.regressiva).toBe(1);
    expect(r.porTipo.sem_foto).toBe(1);
    expect(r.porTipo.consumo_zero).toBe(0);
    expect(r.sumidos).toBe(1);
    // A, B e C têm alerta (C conta uma vez só) + o X que sumiu.
    expect(r.total).toBe(4);
  });

  it("limite é estrito: exatamente no limite não alerta", () => {
    expect(
      resumoDosAlertas([comAlertas(leitura({ consumo: 30 }))], 0).total,
    ).toBe(0);
  });

  it("consumo por bloco soma sem erro de ponto flutuante", () => {
    const r = consumoPorBloco(
      [
        { bloco: "01", consumo: 0.1 },
        { bloco: "01", consumo: 0.2 },
        { bloco: "05", consumo: 5 },
      ],
      [
        { bloco: "01", consumo: 1 },
        { bloco: "09", consumo: 2 },
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
  const prazo = "2026-11-06";
  const envio = (origem: string, enviadoEm: string | null, hoje: string) =>
    situacaoDoEnvio({ origem, enviadoEm }, prazo, hoje);
  const base = { status: "fechado" as const, incompleto: false };

  it("situação vem da situação do envio da tela da Limpeza", () => {
    expect(
      situacaoDoRateio({ ...base, envio: envio("tela", null, "2026-11-05") }),
    ).toBe("fechado");
    expect(
      situacaoDoRateio({ ...base, envio: envio("tela", null, "2026-11-07") }),
    ).toBe("atrasado");
    expect(
      situacaoDoRateio({
        ...base,
        envio: envio("tela", "2026-11-09T12:00:00Z", "2026-11-09"),
      }),
    ).toBe("enviado");
    expect(
      situacaoDoRateio({
        status: "aberto",
        incompleto: true,
        envio: envio("tela", null, "2026-11-05"),
      }),
    ).toBe("incompleto");
  });

  it("mês importado e não enviado é histórico, não atraso", () => {
    expect(
      situacaoDoRateio({
        ...base,
        envio: envio("importacao", null, "2027-03-01"),
      }),
    ).toBe("historico");
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
});

describe("Diário de Obra", () => {
  const hoje = "2026-11-09";
  const obra = (o: Partial<ObraDoDiario>): ObraDoDiario => ({
    id: "o1",
    nome: "Obra A",
    statusId: 3,
    grupo: null,
    responsavel: null,
    // Começou hoje: nenhum dia sem relatório.
    dataInicio: hoje,
    dataFim: "2027-01-31",
    prazo: { contratual: 100, decorrido: 60, aVencer: 40 },
    realizado: 40,
    tarefas: null,
    ficha: null,
    ...o,
  });
  const resumo = (obras: ObraDoDiario[]) =>
    resumoDoDiario(linhasDoPainel(obras, [], [1, 2, 3, 4, 5], hoje), -10);

  it("usa as contas da tela: desvio em pontos e prazo sem teto de 100%", () => {
    const r = resumo([
      obra({ id: "a" }),
      obra({
        id: "b",
        realizado: 90,
        prazo: { contratual: 100, decorrido: 120, aVencer: -20 },
      }),
    ]);
    const [a, b] = r.obras;
    expect(a?.desvio).toBe(-20);
    expect(a?.alerta).toBe(true);
    expect(a?.vencido).toBe(false);
    // Passou do prazo: 120% consumido (não limita em 100) e a vencer < 0.
    expect(b?.prazoPct).toBe(120);
    expect(b?.desvio).toBe(-30);
    expect(b?.vencido).toBe(true);
    expect(r.vencidas).toBe(1);
    expect(r.comAlerta).toBe(2);
    expect(r.emAndamento).toBe(2);
  });

  it("concluída não alerta; paralisada e dias sem relatório alertam", () => {
    const r = resumo([
      obra({
        id: "c",
        statusId: 4,
        realizado: 10,
        prazo: { contratual: 100, decorrido: 100, aVencer: 0 },
      }),
      obra({ id: "p", statusId: 2, realizado: 60 }),
      obra({ id: "s", realizado: 60, dataInicio: "2026-11-02" }),
    ]);
    expect(r.obras.map((o) => [o.id, o.alerta])).toEqual([
      ["c", false],
      ["p", true],
      ["s", true],
    ]);
    expect(r.vencidas).toBe(0);
    expect(r.comAlerta).toBe(2);
  });
});
