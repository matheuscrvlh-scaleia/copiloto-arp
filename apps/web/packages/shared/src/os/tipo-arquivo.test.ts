import { describe, expect, it } from "vitest";
import { conteudoBateComExtensao, tipoPeloConteudo } from "./tipo-arquivo";

const bytes = (...partes: (number[] | string)[]) =>
  new Uint8Array(
    partes.flatMap((p) =>
      typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p,
    ),
  );

const PNG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPG = bytes([0xff, 0xd8, 0xff, 0xe0]);
const HEIC = bytes([0, 0, 0, 0x18], "ftypheic");
const PDF = bytes("%PDF-1.7");
const ZIP = bytes([0x50, 0x4b, 0x03, 0x04]);
const HTML = bytes("<!doctype html>");
const SVG = bytes("<svg xmlns=");

describe("tipo pelo conteúdo", () => {
  it("reconhece foto, PDF e ZIP", () => {
    expect(tipoPeloConteudo(PNG)).toBe("image/png");
    expect(tipoPeloConteudo(JPG)).toBe("image/jpeg");
    expect(tipoPeloConteudo(HEIC)).toBe("image/heic");
    expect(tipoPeloConteudo(bytes("RIFF", [1, 2, 3, 4], "WEBP"))).toBe(
      "image/webp",
    );
    expect(tipoPeloConteudo(PDF)).toBe("application/pdf");
    expect(tipoPeloConteudo(ZIP)).toBe("application/zip");
  });

  it("HTML e SVG não passam por foto", () => {
    expect(tipoPeloConteudo(HTML)).toBeNull();
    expect(tipoPeloConteudo(SVG)).toBeNull();
  });

  it("a extensão só vale com o conteúdo certo", () => {
    expect(conteudoBateComExtensao("foto.PNG", PNG)).toBe(true);
    expect(conteudoBateComExtensao("foto.png", HTML)).toBe(false);
    expect(conteudoBateComExtensao("foto.jpg", PNG)).toBe(false);
    expect(conteudoBateComExtensao("planilha.xlsx", ZIP)).toBe(true);
    expect(conteudoBateComExtensao("laudo.pdf", PDF)).toBe(true);
    expect(conteudoBateComExtensao("planta.dxf", bytes("  0\nSECTION"))).toBe(
      true,
    );
    expect(conteudoBateComExtensao("sem-extensao", PNG)).toBe(false);
  });
});
