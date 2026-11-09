import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";
import type { DetalheDoMes } from "./limpeza";

// O demonstrativo (PDF) e o resultado (Excel) do rateio saem do mesmo
// cálculo da tela. Sem banco: o mês de setembro de 2026 da spec montado à
// mão, como as linhas do banco viriam.

vi.mock("server-only", () => ({}));
vi.mock("@/server/os/base", () => ({ baixarArquivo: async () => null }));

const { entradaDoMes } = await import("./limpeza");
const { calcularRateio } = await import("@/lib/operacoes/limpeza");
const { gerarDemonstrativo } = await import("./limpeza-pdf");
const { planilhaDoRateio } = await import("./limpeza-planilha");

const MINUTOS: [string, number, number][] = [
  ["01", 131, 73],
  ["02", 67, 74],
  ["04", 229, 150],
  ["05", 295, 226],
  ["09", 152, 114],
  ["10", 178, 115],
  ["11", 167, 148],
];

function setembro(): DetalheDoMes {
  const mes = {
    referencia: "2026-09-01",
    importacao_id: null,
    apontamento: "APONTAMENTO 09.2026",
    valor_base: 35323.94,
    base_composicao: "38.509,83 − 8.072,68 + 1.736,79 + 630,00 + 2.520,00",
    func_base: 9,
    func_area_comum: 5,
    func_rateados: 4,
    regra_bl04: "separado",
    status: "fechado",
    incompleto: false,
    origem: "tela",
    valores_planilha: null,
    fechado_por: null,
    fechado_em: "2026-10-05T20:00:00Z",
    reaberto_por: null,
    reaberto_em: null,
    reaberto_motivo: null,
    enviado_por: null,
    enviado_em: null,
    exemplo: false,
    criado_por: null,
    criado_em: "2026-10-01T12:00:00Z",
    atualizado_em: "2026-10-05T20:00:00Z",
  };
  const extras = [
    {
      descricao: "Insalubridade espaço pet",
      quantidade: null,
      valor_unitario: null,
      valor: 278.68,
    },
    {
      descricao: "Limpeza banheiros (por auxiliar/mês)",
      quantidade: 4,
      valor_unitario: 3897,
      valor: 15588,
    },
    {
      descricao: "Vigia extra fins de semana",
      quantidade: 8,
      valor_unitario: 315,
      valor: 2520,
    },
    {
      descricao: "Insalubridade limpeza de banheiro",
      quantidade: null,
      valor_unitario: null,
      valor: 2497.99,
    },
    {
      descricao: "Limpeza extra banheiros domingos e feriados",
      quantidade: 5,
      valor_unitario: 315,
      valor: 1575,
    },
  ];
  const minutos = MINUTOS.map(([bloco, limpeza, manutencao]) => ({
    referencia: "2026-09-01",
    bloco,
    limpeza,
    manutencao,
  }));
  const contrato = [
    {
      descricao: "Limpeza com 13 auxiliares",
      valor: 53688.61,
      entra_conferencia: true,
    },
    {
      descricao: "2 vigias extras de fim de semana",
      valor: 2520,
      entra_conferencia: true,
    },
    {
      descricao: "1 limpeza de banheiro em domingos e feriados",
      valor: 1575,
      entra_conferencia: true,
    },
  ];
  const entrada = entradaDoMes(
    mes,
    extras,
    minutos,
    contrato,
    MINUTOS.map((m) => m[0]),
  );
  return {
    mes,
    extras,
    minutos,
    contrato,
    equipe: [],
    anexos: [],
    blocos: entrada.blocos,
    entrada,
    resultado: calcularRateio(entrada),
    lancou: { nome: "Pessoa de Operações", em: mes.criado_em },
    fechou: { nome: "Pessoa de Operações", em: mes.fechado_em },
    reabriu: null,
    enviou: null,
    emPrevia: false,
  };
}

describe("arquivos do rateio", () => {
  it("o mês do banco dá a conta de setembro", () => {
    const d = setembro();
    expect(d.resultado.total).toBe(5778361);
    expect(d.resultado.areaComum).toBe(4208408);
    expect(d.resultado.conferencia.situacao).toBe("bate");
  });

  it("demonstrativo completo e o de um bloco viram PDF", async () => {
    const d = setembro();
    for (const bloco of [undefined, "04"]) {
      const bytes = await gerarDemonstrativo({
        detalhe: d,
        empresa: "Empresa de limpeza",
        bloco,
        geradoEm: "09/11/2026 10:15 por Teste",
      });
      const pdf = await PDFDocument.load(bytes);
      expect(pdf.getPageCount()).toBeGreaterThan(0);
      expect(pdf.getTitle()).toContain("set/2026");
    }
  });

  it("Excel com o resultado por local, os extras e a memória", async () => {
    const bytes = await planilhaDoRateio(
      setembro(),
      "Empresa de limpeza",
      "agora",
    );
    const livro = new ExcelJS.Workbook();
    await livro.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
    expect(livro.worksheets.map((w) => w.name)).toEqual([
      "Rateio",
      "Extras da área comum",
      "Memória de cálculo",
    ]);
    const aba = livro.getWorksheet("Rateio");
    const valores = [5, 6, 7, 8, 9, 10, 11, 12, 13].map(
      (l) => aba?.getCell(l, 6).value,
    );
    expect(valores).toEqual([
      42084.08, 1511.42, 1044.66, 2807.99, 3860.05, 1970.78, 2170.82, 2333.81,
      57783.61,
    ]);
  });
});
