import { describe, expect, it } from "vitest";
import { NOME_MAX, nomeSeguro } from "./nome";

describe("nome seguro do arquivo", () => {
  it("tira acento, espaço e símbolo", () => {
    expect(nomeSeguro("Rebranding Espaço Arp – Doc Final.pdf")).toBe(
      "rebranding-espaco-arp-doc-final.pdf",
    );
    expect(nomeSeguro("RATEIO BS E MANUTENÇÃO (2026).xlsx")).toBe(
      "rateio-bs-e-manutencao-2026-.xlsx",
    );
  });

  it("barra não vira pasta e ponto no começo não vira arquivo oculto", () => {
    expect(nomeSeguro("../../etc/passwd")).toBe("etc-passwd");
    expect(nomeSeguro(String.raw`C:\fotos\H 12.jpg`)).toBe("c-fotos-h-12.jpg");
    expect(nomeSeguro(".env")).toBe("env");
  });

  it("nome vazio ou só símbolos usa o padrão", () => {
    expect(nomeSeguro("")).toBe("arquivo");
    expect(nomeSeguro("###", "fatura.pdf")).toBe("fatura.pdf");
  });

  it("corta pelo começo e guarda a extensão", () => {
    const r = nomeSeguro(`${"a".repeat(300)}.pdf`);
    expect(r.length).toBe(NOME_MAX);
    expect(r.endsWith(".pdf")).toBe(true);
    // O corte não deixa ponto ou hífen no começo.
    expect(nomeSeguro(`${"b".repeat(200)}-.${"c".repeat(118)}`)).toBe(
      "c".repeat(118),
    );
  });
});
