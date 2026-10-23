import { describe, expect, it } from "vitest";
import {
  codificarPng,
  desenharFoto,
  fotoDeExemplo,
  quebrar,
  textoDaFonte,
} from "./exemplo-imagem";
import { crc32 } from "./importacao-zip";

async function descomprimir(bytes: Uint8Array): Promise<Uint8Array> {
  const fluxo = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

describe("foto de exemplo", () => {
  it("texto sem acento e só com o que a fonte desenha", () => {
    expect(textoDaFonte("Ventilação, Janelas, Climatização")).toBe(
      "VENTILACAO, JANELAS, CLIMATIZACAO",
    );
    expect(textoDaFonte("Tem banheiro? (sim)")).toBe("TEM BANHEIRO (SIM)");
  });

  it("quebra sem cortar palavra", () => {
    expect(quebrar("TEM BANHEIRO (SE SIM, DESCREVER ABAIXO)", 25)).toEqual([
      "TEM BANHEIRO (SE SIM,",
      "DESCREVER ABAIXO)",
    ]);
  });

  it("crc32 conhecido", () => {
    expect(crc32(new TextEncoder().encode("IEND"))).toBe(0xae426082);
  });

  it("PNG válido com o tamanho certo", async () => {
    const png = await fotoDeExemplo("Piso", 42);
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const v = new DataView(png.buffer, png.byteOffset);
    expect(String.fromCharCode(...png.subarray(12, 16))).toBe("IHDR");
    expect(v.getUint32(16)).toBe(480);
    expect(v.getUint32(20)).toBe(320);
    // Pequena o bastante para gravar dezenas de uma vez.
    expect(png.length).toBeLessThan(120_000);
  });

  it("os pixels voltam iguais depois de descomprimir", async () => {
    const rgb = new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 9, 9, 9]);
    const png = await codificarPng(rgb, 2, 2);
    const tamanho = new DataView(png.buffer, png.byteOffset).getUint32(33);
    const cru = await descomprimir(png.subarray(41, 41 + tamanho));
    expect([...cru]).toEqual([0, 255, 0, 0, 0, 255, 0, 0, 0, 0, 255, 9, 9, 9]);
  });

  it("mesma semente, mesma foto", () => {
    // Byte a byte num laço: o toEqual em 1 MB passa dos 5 s com os testes
    // rodando em paralelo.
    const a = desenharFoto("Teto", 7);
    const b = desenharFoto("Teto", 7);
    expect(b.length).toBe(a.length);
    expect(a.every((v, i) => v === b[i])).toBe(true);
  });
});
