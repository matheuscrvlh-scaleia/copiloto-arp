import { PDFDocument } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";
import { textoDoTermoClube } from "@/lib/sustentabilidade/clube-termo";

// PDF do termo do Clube: abre, tem uma página A4, e leva a assinatura
// desenhada na tela quando existe. Sem a imagem oficial do papel timbrado, o
// PDF usa o papel desenhado.

vi.mock("server-only", () => ({}));
vi.mock("@/server/os/base", () => ({ baixarArquivo: async () => null }));

const { gerarTermoClubePdf } = await import("./termo-pdf");

const TEXTO = textoDoTermoClube({
  assinadoEm: "2026-03-10",
  validoAte: "2027-03-10",
  ano: 2026,
  validadeMeses: 12,
  participante: { nome: "Café da Serra Ltda", doc: "12345678000190" },
  formas: ["Pagante", "Contribui com resíduos"],
  assinante: { nome: "Maria Souza", documento: "12345678909" },
  arp: {
    razaoSocial: "ARP EMPREENDIMENTOS IMOBILIÁRIOS LTDA",
    cnpj: "33.111.139/0001-61",
    cidade: "Nova Friburgo",
  },
});
const META = { titulo: "Termo de teste", autor: "ARP" };

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
