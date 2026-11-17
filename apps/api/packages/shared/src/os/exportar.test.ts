import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  type DadosExportar,
  emPaisagem,
  gerarExcel,
  gerarPdf,
  largurasDasColunas,
  nomeDaAba,
  nomeDoArquivo,
  quebrarTexto,
  textoDaCelula,
  textoGerado,
  textoTotal,
} from "./exportar";

// 23/10/2026 às 22h em Brasília: em UTC já é dia 24.
const agora = new Date("2026-10-24T01:00:00Z");

const dados = (n: number, colunas = 3): DadosExportar => ({
  titulo: "Minha caixa",
  filtros: "Tipo: Ordem de Serviço · Setor: Operações",
  colunas: [
    { titulo: "Número" },
    { titulo: "Título" },
    { titulo: "Valor", numero: true, formato: "#,##0.00" },
    ...Array.from({ length: colunas - 3 }, (_, i) => ({
      titulo: `Extra ${i + 1}`,
    })),
  ],
  linhas: Array.from({ length: n }, (_, i) => [
    `#${i + 1}`,
    `Trocar lâmpada do corredor ${i + 1} — bloco B`,
    1234.5 + i,
    ...Array.from({ length: colunas - 3 }, () => "texto"),
  ]),
  geradoEm: agora,
});

describe("textos da exportação", () => {
  it("nome do arquivo com a data de Brasília", () => {
    expect(nomeDoArquivo("Minha caixa", agora, "xlsx")).toBe(
      "minha-caixa-2026-10-23.xlsx",
    );
    expect(nomeDoArquivo("", agora, "pdf")).toBe("exportacao-2026-10-23.pdf");
  });

  it("gerado em, total e células", () => {
    expect(textoGerado(agora)).toBe("Gerado em 23/10/2026 22:00");
    expect(textoTotal(1)).toBe("Total: 1 linha");
    expect(textoTotal(1200)).toBe("Total: 1.200 linhas");
    expect(textoDaCelula(1234.5, { titulo: "x", formato: "#,##0.00" })).toBe(
      "1.234,50",
    );
    expect(textoDaCelula(7)).toBe("7");
    expect(textoDaCelula(null)).toBe("");
    expect(nomeDaAba("Abertos por mim: [OS]")).toBe("Abertos por mim   OS");
  });

  it("paisagem a partir de 7 colunas", () => {
    expect(emPaisagem(dados(1, 6).colunas)).toBe(false);
    expect(emPaisagem(dados(1, 7).colunas)).toBe(true);
  });
});

describe("largurasDasColunas", () => {
  it("cabe: cresce na proporção até ocupar tudo", () => {
    const l = largurasDasColunas([50, 100], 300);
    expect(l[0]).toBeCloseTo(100);
    expect(l[1]).toBeCloseTo(200);
  });

  it("não cabe: as largas encolhem primeiro", () => {
    const l = largurasDasColunas([40, 400, 400], 500);
    expect(l.reduce((s, w) => s + w, 0)).toBeCloseTo(500);
    expect(l[0]).toBeCloseTo(40, 0);
    expect(l[1]).toBeCloseTo(l[2] ?? 0);
  });
});

describe("quebrarTexto", () => {
  const medir = (t: string) => t.length;
  it("quebra por palavra e corta com reticências", () => {
    expect(quebrarTexto("um dois três", 8, medir)).toEqual(["um dois", "três"]);
    expect(quebrarTexto("aa bb cc dd ee ff", 5, medir, 2)).toEqual([
      "aa bb",
      "cc d…",
    ]);
  });
  it("palavra maior que a coluna é cortada", () => {
    expect(quebrarTexto("abcdefgh", 4, medir)).toEqual(["abcd", "efgh"]);
  });
});

describe("gerarExcel", () => {
  it("título, filtros, cabeçalho em negrito, números como número e total", async () => {
    const bytes = await gerarExcel(dados(3));
    const livro = new ExcelJS.Workbook();
    await livro.xlsx.load(bytes.buffer as ArrayBuffer);
    const aba = livro.worksheets[0];
    expect(aba?.name).toBe("Minha caixa");
    expect(aba?.getCell("A1").value).toBe("Minha caixa");
    expect(aba?.getCell("A2").value).toBe(
      "Tipo: Ordem de Serviço · Setor: Operações",
    );
    expect(aba?.getCell("A3").value).toBe("Gerado em 23/10/2026 22:00");
    expect(aba?.getCell("A5").value).toBe("Número");
    expect(aba?.getCell("A5").font?.bold).toBe(true);
    expect(aba?.getCell("C6").value).toBe(1234.5);
    expect(aba?.getCell("C6").numFmt).toBe("#,##0.00");
    expect(aba?.getCell("A10").value).toBe("Total: 3 linhas");
  });
});

describe("gerarPdf", () => {
  it("retrato com poucas colunas, paisagem com muitas", async () => {
    const retrato = await PDFDocument.load(await gerarPdf(dados(2)));
    const [w, h] = [
      retrato.getPage(0).getWidth(),
      retrato.getPage(0).getHeight(),
    ];
    expect(w).toBeLessThan(h);
    const deitado = await PDFDocument.load(await gerarPdf(dados(2, 8)));
    expect(deitado.getPage(0).getWidth()).toBeGreaterThan(
      deitado.getPage(0).getHeight(),
    );
  });

  it("quebra páginas quando a lista é longa", async () => {
    const pdf = await PDFDocument.load(await gerarPdf(dados(200)));
    expect(pdf.getPageCount()).toBeGreaterThan(2);
    expect(pdf.getTitle()).toBe("Minha caixa");
  });

  it("lista vazia ainda gera o arquivo", async () => {
    const pdf = await PDFDocument.load(await gerarPdf(dados(0)));
    expect(pdf.getPageCount()).toBe(1);
  });
});
