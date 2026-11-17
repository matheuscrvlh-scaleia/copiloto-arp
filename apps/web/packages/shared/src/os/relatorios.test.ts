import { describe, expect, it } from "vitest";
import type { Sessao } from "./calculos";
import {
  arquivoAbertas,
  arquivoRateio,
  arquivoTerceirizados,
  COLUNAS_LANCAMENTOS,
  dataHoraBr,
  emitidoEm,
  fechadaNoPeriodo,
  linhaAberta,
  linhaLancamento,
  linhasConfiguracao,
  linhaTerceirizado,
  type OSRelatorio,
  resumoDeCustos,
  resumoPorTipo,
} from "./relatorios";

const sessao = (s: Partial<Sessao>): Sessao => ({
  data: "2026-10-21",
  inicio: "08:00",
  fim: "12:00",
  almoco_inicio: null,
  almoco_fim: null,
  tecnicos: ["ana"],
  ...s,
});

const os = (o: Partial<OSRelatorio>): OSRelatorio => ({
  numero: 1201,
  titulo: "Troca de lâmpadas",
  descricao: "Corredor do bloco B",
  tipoServico: "ELÉTRICA",
  status: "fechado",
  rateio: true,
  criadoEm: "2026-10-20T13:00:00Z",
  criadoPor: "Ana Exemplo",
  fechadoEm: "2026-10-22T19:30:00Z",
  fechadoPor: "Bia Exemplo",
  sessoes: [
    sessao({ data: "2026-10-22", inicio: "13:00", fim: "15:30" }),
    sessao({
      tecnicos: ["ana", "bia"],
      almoco_inicio: "11:30",
      almoco_fim: "13:00",
    }),
  ],
  tecnicos: ["Ana Exemplo", "Bia Exemplo"],
  valor: 274.19,
  valorRateio: 82.26,
  visitaPeriodo: null,
  visitaData: null,
  profissionais: [],
  solucao: null,
  ...o,
});

describe("período", () => {
  it("usa a data de fechamento em Brasília", () => {
    // 23/10 01:00 UTC = 22/10 22:00 em Brasília.
    expect(
      fechadaNoPeriodo("2026-10-23T01:00:00Z", "2026-10-01", "2026-10-22"),
    ).toBe(true);
    expect(
      fechadaNoPeriodo("2026-10-23T03:00:00Z", "2026-10-01", "2026-10-22"),
    ).toBe(false);
    expect(fechadaNoPeriodo(null, "2026-10-01", "2026-10-31")).toBe(false);
    expect(dataHoraBr("2026-10-22T19:30:00Z")).toBe("22/10/2026 16:30");
  });
});

describe("planilha de rateio", () => {
  it("lançamento com as 17 colunas do sistema atual", () => {
    const l = linhaLancamento(os({}));
    expect(l).toHaveLength(COLUNAS_LANCAMENTOS.length);
    expect(l).toEqual([
      "1201 / ELÉTRICA",
      "Troca de lâmpadas",
      "20/10/2026",
      "22/10/2026",
      "21/10/2026",
      "08:00",
      "15:30",
      "Ana Exemplo; Bia Exemplo",
      360,
      274.19,
      82.26,
      "SIM",
      "Principal: 21/10/2026 08:00–12:00 | Continuação: 22/10/2026 13:00–15:30 | Almoço principal descontado: 11:30–13:00",
      "Ana Exemplo",
      "20/10/2026 10:00",
      "Bia Exemplo",
      "22/10/2026 16:30",
    ]);
  });

  it("sem sessões, deixa data e horas em branco", () => {
    const l = linhaLancamento(os({ sessoes: [], tecnicos: [] }));
    expect(l.slice(4, 9)).toEqual(["", "", "", "", 0]);
  });

  it("configuração por colaborador", () => {
    const oss = [
      os({}),
      os({
        tipoServico: "HIDRÁULICA",
        rateio: false,
        tecnicos: ["Ana Exemplo"],
      }),
    ];
    const linhas = linhasConfiguracao(
      oss,
      (n) => (n === "Ana Exemplo" ? 0.5 : null),
      "2026-10-01",
      "2026-10-31",
    );
    expect(linhas).toEqual([
      [
        "Ana Exemplo",
        0.5,
        30,
        "ELÉTRICA; HIDRÁULICA",
        "SIM / NÃO",
        "01/10/2026 a 31/10/2026",
      ],
      ["Bia Exemplo", null, null, "ELÉTRICA", "SIM", "01/10/2026 a 31/10/2026"],
    ]);
  });

  it("resumo de custos e por tipo", () => {
    const oss = [
      os({}),
      os({ numero: 1202, rateio: false, valor: 100, valorRateio: 0 }),
      os({ numero: 1203, tipoServico: "ROTINA", valor: 10, valorRateio: 10 }),
    ];
    expect(resumoDeCustos(oss, true)).toEqual([
      ["Serviços finalizados", 3],
      ["Minutos de serviço", 1080],
      ["Minutos somados da equipe", 1710],
      ["Total em reais", 384.19],
      ["Total com rateio em reais", 92.26],
      ["O.S. com rateio", 2],
      ["O.S. sem rateio", 1],
    ]);
    expect(resumoDeCustos(oss, false)[3]).toEqual(["Total em reais", null]);
    expect(resumoPorTipo(oss, true)).toEqual([
      ["ELÉTRICA", 1, 1, 2, 374.19, 82.26],
      ["ROTINA", 1, 0, 1, 10, 10],
    ]);
  });

  it("nomes de arquivo", () => {
    expect(arquivoRateio("2026-10-01", "2026-10-31")).toBe(
      "PLANILHA-RATEIO-OS-FINALIZADAS-2026-10-01-a-2026-10-31.xlsx",
    );
    expect(arquivoTerceirizados("2026-10-01", "2026-10-31")).toBe(
      "OS-Terceirizados-Finalizadas-2026-10-01-a-2026-10-31.xlsx",
    );
    expect(arquivoAbertas(new Date("2026-10-23T02:00:00Z"), "pdf")).toBe(
      "OS-Abertas-2026-10-22.pdf",
    );
  });
});

describe("terceirizados e abertas", () => {
  it("linha do terceirizado", () => {
    expect(
      linhaTerceirizado(
        os({
          visitaPeriodo: "tarde",
          profissionais: ["Carlos Exemplo", "Dani Exemplo"],
          solucao: "Troca do reator",
        }),
      ),
    ).toEqual([
      "1201 / ELÉTRICA",
      "Troca de lâmpadas",
      "22/10/2026",
      "Tarde",
      "Carlos Exemplo; Dani Exemplo",
      "Troca do reator",
    ]);
  });

  it("linha da OS em aberto", () => {
    expect(linhaAberta(os({ status: "aguardando", valor: null }))).toEqual([
      1201,
      "Aguardando",
      "ELÉTRICA",
      "Sim",
      "Ana Exemplo; Bia Exemplo",
      "Principal: 21/10/2026 08:00–12:00 | Continuação: 22/10/2026 13:00–15:30 | Almoço principal descontado: 11:30–13:00",
      "6h",
      "9h 30min",
      null,
      "Corredor do bloco B",
    ]);
    expect(emitidoEm(new Date("2026-10-23T13:05:00Z"))).toBe(
      "Emitido em 23/10/2026 10:05",
    );
  });
});
