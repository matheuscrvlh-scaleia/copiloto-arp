import { PDFDocument } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// O papel timbrado procura a imagem enviada em Parâmetros: aqui não há.
vi.mock("@/server/os/base", () => ({ baixarArquivo: async () => null }));

import type { PeriodoApurado } from "@/lib/sustentabilidade/painel-apuracao";
import {
  type EntradaDoPainel,
  montarPainel,
} from "@/lib/sustentabilidade/painel-montagem";
import { gerarRelatorioDoMes } from "./painel-pdf";

const mensal = (porMes: (number | null)[]) => ({
  total: porMes.some((v) => v !== null)
    ? porMes.reduce<number>((t, v) => t + (v ?? 0), 0)
    : null,
  porMes,
});

const periodo = (ano: number): PeriodoApurado => ({
  ano,
  ateMes: 10,
  volume: mensal([1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200, 2300, 2400]),
  pessoas: mensal([300, 400, 350, 500, 450, 600, 550, 700, 650, 800]),
  oficinas: mensal([1, 2, 3, 2, 4, 3, 1, 2, 3, 2]),
  produtores: { participacoes: 1044, unicos: 165 },
  energia: mensal([8000, 8500, 9000, 8100, 7400, 6800, 7010, 7920, 8500, null]),
  co2: null,
  rcc: {
    a: mensal([24, 16, 24, null, 32, 24, 16, 24, 24, 16]),
    b: mensal([8, 8, 8, null, 8, 8, 8, 0, 8, 8]),
    total: mensal([32, 24, 32, null, 40, 32, 24, 24, 32, 24]),
    pctReciclado: 75,
    economia: 12345.67,
  },
});

const entrada = (comValores: boolean): EntradaDoPainel => ({
  filtros: { ano: 2026, ateMes: 10, comparar: true },
  atual: periodo(2026),
  anterior: periodo(2025),
  desdeOInicio: { valor: 60000, marcoAteAno: 2025 },
  agua: { m3: 1100, anterior: 1000, incompleta: true },
  clube: { ativos: 27, locatarios: 27, clientes: 178, participacao: 15.2 },
  entrevistas: {
    emDia: 150,
    precisam: 160,
    pct: 93.75,
    pendentes: 6,
    vencidas: 4,
  },
  ocupacao: { preto: 78, azul: 60, rondas: 4 },
  limiteOcupacao: 90,
  metas: {},
  comValores,
  equivalencias: [
    { nome: "Árvores", fator: 17, unidade: "árvores", confirmado: true },
  ],
});

describe("relatório do mês em PDF", () => {
  it("gera uma página só, com todos os indicadores, sem estourar a fonte (CO₂, m³, ≈)", async () => {
    const painel = montarPainel(entrada(true));
    const bytes = await gerarRelatorioDoMes({
      mes: "Outubro de 2026",
      periodo: "janeiro a outubro de 2026",
      anoAnterior: "2025",
      geradoEm: "16/11/2026 14:30, por Responsável",
      cartoes: painel.cartoes,
      comparacao: painel.comparacao,
      graficos: painel.graficos,
      equivalencias: painel.equivalencias,
      exemplo: ["Programas", "RCC"],
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
  });

  it("sem valores o PDF também sai, sem o cartão em reais", async () => {
    const painel = montarPainel(entrada(false));
    expect(painel.cartoes.some((c) => c.chave === "rcc_economia")).toBe(false);
    const bytes = await gerarRelatorioDoMes({
      mes: "Outubro de 2026",
      periodo: "janeiro a outubro de 2026",
      anoAnterior: "2025",
      geradoEm: "16/11/2026 14:30, por Responsável",
      cartoes: painel.cartoes,
      comparacao: painel.comparacao,
      graficos: painel.graficos,
      equivalencias: [],
      exemplo: [],
    });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});
