import { textoDoTermoClube } from "@arp/shared/sustentabilidade/clube-termo";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";

// PDF do termo do Clube: abre, tem uma página A4, e leva a assinatura
// desenhada na tela quando existe. Sem a imagem oficial do papel timbrado, o
// PDF usa o papel desenhado.

vi.mock("@/infra/arquivos", () => ({ lerArquivo: async () => null }));

const { gerarTermoClubePdf } = await import("./termo-pdf");

const TEXTO = textoDoTermoClube({
  assinadoEm: "2026-03-10",
  validoAte: "2027-03-10",
  ano: 2026,
  validadeMeses: 12,
  participante: { nome: "Café de Teste Ltda", doc: "12345678000190" },
  formas: ["Pagante", "Contribui com resíduos"],
  assinante: { nome: "Pessoa de Teste", documento: "12345678909" },
  arp: {
    razaoSocial: "EMPRESA DE TESTE LTDA",
    cnpj: "00.000.000/0001-00",
    cidade: "Cidade",
  },
});
const META = { titulo: "Termo de teste", autor: "Teste" };

// PNG de 1 × 1 pixel.
const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  ),
);

describe("gerarTermoClubePdf", () => {
  it("gera um PDF de uma página A4 sem assinatura (linha em branco)", async () => {
    const bytes = await gerarTermoClubePdf(TEXTO, null, META);
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
    expect(doc.getTitle()).toBe("Termo de teste");
  });

  it("com a assinatura da tela o PDF guarda a imagem", async () => {
    const sem = await gerarTermoClubePdf(TEXTO, null, META);
    const com = await gerarTermoClubePdf(TEXTO, PNG, META);
    const doc = await PDFDocument.load(com);
    expect(doc.getPageCount()).toBe(1);
    expect(com.length).toBeGreaterThan(sem.length);
  });
});
