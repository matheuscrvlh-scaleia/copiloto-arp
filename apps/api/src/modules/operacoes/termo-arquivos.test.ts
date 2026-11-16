import { textoDoTermo } from "@arp/shared/operacoes/termo";
import { unzipSync } from "fflate";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";

// PDF e Word do termo de energia: abrem, têm uma página A4 (PDF) e o Word
// leva o mesmo texto da prévia. Sem a imagem oficial do papel timbrado, o
// PDF usa o papel desenhado e o Word a logo no cabeçalho.

vi.mock("@/infra/arquivos", () => ({ lerArquivo: async () => null }));

const { gerarTermoPdf } = await import("./termo-pdf");
const { gerarTermoDocx } = await import("./termo-docx");

const TEXTO = textoDoTermo(
  {
    dataEmissao: "2026-10-08",
    locatario: "Ateliê de Teste",
    documento: "00.000.901/0001-00",
    qualificacao: "pessoa jurídica, locatária",
    bloco: "Bloco 12",
    pavimento: "1º pavimento (térreo)",
    sala: "Sala 104",
    projeto: "PE 00000 00 000",
    amperes: 40,
    ligacao: "Monofásica",
    armario: "16",
    rota: "14-250-1980",
    observacaoTecnica: "Cabo 10 mm², tensão 127/220 V.",
  },
  {
    razaoSocial: "EMPRESA DE TESTE LTDA",
    cnpj: "00.000.000/0001-00",
    endereco: "Rua de Teste, nº 1, Centro, Cidade/UF",
    cidade: "Cidade",
  },
);
const META = { titulo: "TERMO DE TESTE", autor: "Teste" };

describe("arquivos do termo", () => {
  it("PDF: uma página A4 com título e autor", async () => {
    const pdf = await PDFDocument.load(await gerarTermoPdf(TEXTO, META));
    expect(pdf.getPageCount()).toBe(1);
    const { width, height } = pdf.getPage(0).getSize();
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
    expect(pdf.getTitle()).toBe("TERMO DE TESTE");
  });

  it("Word: o mesmo texto, com a logo no cabeçalho", async () => {
    const zip = unzipSync(await gerarTermoDocx(TEXTO, META));
    const doc = new TextDecoder().decode(zip["word/document.xml"]);
    for (const p of [TEXTO.data, TEXTO.titulo, ...TEXTO.paragrafos])
      expect(doc).toContain(p.replace(/&/g, "&amp;"));
    expect(doc).toContain('w:val="both"');
    expect(Object.keys(zip).some((k) => k.startsWith("word/media/"))).toBe(
      true,
    );
  });
});
