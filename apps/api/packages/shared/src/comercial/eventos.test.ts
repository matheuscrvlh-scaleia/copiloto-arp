import { describe, expect, it } from "vitest";
import {
  diasUteisAntes,
  type FaixaPreco,
  faixaDaArea,
  resumoDasPropostas,
  simular,
  valoresDaProposta,
} from "./eventos";

// Tabela de preços de hoje (spec 4.15), igual à da migration.
const FAIXAS: FaixaPreco[] = [
  {
    ordem: 0,
    nome: "Fixo",
    area_de: 0,
    area_ate: 25,
    fixo: true,
    valor_comum: 275,
    valor_sazonal: 550,
  },
  {
    ordem: 1,
    nome: "1",
    area_de: 0,
    area_ate: 100,
    fixo: false,
    valor_comum: 11,
    valor_sazonal: 22,
  },
  {
    ordem: 2,
    nome: "2",
    area_de: 100,
    area_ate: 300,
    fixo: false,
    valor_comum: 8.25,
    valor_sazonal: 16.5,
  },
  {
    ordem: 3,
    nome: "3",
    area_de: 300,
    area_ate: 1000,
    fixo: false,
    valor_comum: 5.5,
    valor_sazonal: 11,
  },
  {
    ordem: 4,
    nome: "4",
    area_de: 1000,
    area_ate: 3000,
    fixo: false,
    valor_comum: 3.85,
    valor_sazonal: 7.7,
  },
];
const REGRAS = { pessoasPorSeguranca: 100, m2PorAgente: 200 };

describe("simulador de eventos", () => {
  it("730 m², 1 dia, 30%, 1.000 pessoas: o exemplo da planilha", () => {
    const comum = simular(FAIXAS, REGRAS, {
      tipo: "comum",
      area: 730,
      dias: 1,
      descontoPct: 30,
      pessoas: 1000,
    });
    expect(comum).toMatchObject({
      valorDia: 4015,
      valor: 4015,
      desconto: 1204.5,
      final: 2810.5,
      segurancas: 10,
      agentes: 4,
    });
    const sazonal = simular(FAIXAS, REGRAS, {
      tipo: "sazonal",
      area: 730,
      dias: 1,
      descontoPct: 30,
      pessoas: 1000,
    });
    expect(sazonal).toMatchObject({ valor: 8030, final: 5621 });
  });

  it("até 25 m² vale o valor fixo do dia; dias multiplicam", () => {
    const s = simular(FAIXAS, REGRAS, {
      tipo: "comum",
      area: 20,
      dias: 3,
      descontoPct: 0,
      pessoas: 50,
    });
    expect(s).toMatchObject({
      valorDia: 275,
      valor: 825,
      final: 825,
      segurancas: 1,
      agentes: 1,
    });
  });

  it("limite da faixa fica na faixa de baixo; acima da tabela usa a última e avisa", () => {
    expect(faixaDaArea(FAIXAS, 25)?.nome).toBe("Fixo");
    expect(faixaDaArea(FAIXAS, 26)?.nome).toBe("1");
    expect(faixaDaArea(FAIXAS, 100)?.nome).toBe("1");
    expect(faixaDaArea(FAIXAS, 100.5)?.nome).toBe("2");
    expect(faixaDaArea(FAIXAS, 1000)?.nome).toBe("3");
    expect(faixaDaArea(FAIXAS, 0)).toBeNull();
    const grande = simular(FAIXAS, REGRAS, {
      tipo: "comum",
      area: 4000,
      dias: 1,
      descontoPct: 0,
      pessoas: 0,
    });
    expect(grande?.faixa.nome).toBe("4");
    expect(grande?.acimaDaTabela).toBe(true);
  });

  it("proposta: parceria após a condição; final tira o desconto de 1ª edição", () => {
    const s = simular(FAIXAS, REGRAS, {
      tipo: "comum",
      area: 730,
      dias: 1,
      descontoPct: 30,
      pessoas: 0,
    });
    if (!s) throw new Error("sem simulação");
    expect(valoresDaProposta(s, 310.5)).toEqual({
      valor_original: 4015,
      valor_parceria: 2810.5,
      desconto_primeira_edicao: 310.5,
      valor_final: 2500,
    });
    expect(valoresDaProposta(s, 9999).valor_final).toBe(0);
  });
});

describe("fechamento máximo", () => {
  const cal = {
    feriados: new Set(["2026-11-20", "2026-11-02"]),
    diasUteis: [1, 2, 3, 4, 5],
  };
  it("conta dias úteis para trás, pulando fim de semana e feriado", () => {
    // 23/11/2026 é segunda; 20/11 (sexta) é feriado.
    expect(diasUteisAntes("2026-11-23", 1, cal)).toBe("2026-11-19");
    expect(diasUteisAntes("2026-11-23", 0, cal)).toBe("2026-11-23");
    // 30 dias úteis antes de 15/12/2026 (terça), com os 2 feriados no caminho.
    expect(diasUteisAntes("2026-12-15", 30, cal)).toBe("2026-10-30");
  });
});

describe("cartões das propostas", () => {
  it("conta as do mês, as fechadas e soma o valor fechado", () => {
    expect(
      resumoDasPropostas(
        [
          {
            criado_em: "2026-11-02T10:00:00Z",
            status: "rascunho",
            valor_final: 100,
          },
          {
            criado_em: "2026-11-03T10:00:00Z",
            status: "fechada",
            valor_final: 2810.5,
          },
          {
            criado_em: "2026-10-03T10:00:00Z",
            status: "fechada",
            valor_final: 1000,
          },
          {
            criado_em: "2026-10-04T10:00:00Z",
            status: "perdida",
            valor_final: 500,
          },
        ],
        "2026-11-01",
      ),
    ).toEqual({ noMes: 2, fechadas: 2, valorFechado: 3810.5 });
  });
});

describe("propostas no mês, no horário de Brasília", () => {
  it("a do dia 31 às 22h conta no próprio mês, não no seguinte", () => {
    const de = (criado_em: string) => ({
      criado_em,
      status: "rascunho",
      valor_final: 0,
    });
    // 31/10 22h em Brasília = 01/11 01h UTC.
    const propostas = [de("2026-11-01T01:00:00Z"), de("2026-11-01T03:00:00Z")];
    expect(resumoDasPropostas(propostas, "2026-10-01").noMes).toBe(1);
    expect(resumoDasPropostas(propostas, "2026-11-01").noMes).toBe(1);
  });
});
