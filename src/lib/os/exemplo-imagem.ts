// Fotos de exemplo das vistorias: um degradê com o nome do ambiente,
// desenhado em código e gravado como PNG, para o laudo e a galeria terem o
// que mostrar sem nenhuma foto real. Sem dependências: fonte 5x7 própria e
// PNG montado à mão (a compressão é a do próprio runtime).

import { crc32 } from "./importacao-zip";

const LARGURA = 480;
const ALTURA = 320;

/** Fonte 5x7: cada linha é um número de 5 bits (bit 4 = coluna da esquerda). */
const FONTE: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 17, 25, 21, 19, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 21, 10],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 17, 10, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  "0": [14, 17, 19, 21, 25, 17, 14],
  "1": [4, 12, 4, 4, 4, 4, 14],
  "2": [14, 17, 1, 2, 4, 8, 31],
  "3": [31, 2, 4, 2, 1, 17, 14],
  "4": [2, 6, 10, 18, 31, 2, 2],
  "5": [31, 16, 30, 1, 1, 17, 14],
  "6": [6, 8, 16, 30, 17, 17, 14],
  "7": [31, 1, 2, 4, 8, 8, 8],
  "8": [14, 17, 17, 14, 17, 17, 14],
  "9": [14, 17, 17, 15, 1, 2, 12],
  ",": [0, 0, 0, 0, 12, 4, 8],
  ".": [0, 0, 0, 0, 0, 12, 12],
  "-": [0, 0, 0, 31, 0, 0, 0],
  "(": [2, 4, 8, 8, 8, 4, 2],
  ")": [8, 4, 2, 2, 2, 4, 8],
  "/": [1, 1, 2, 4, 8, 16, 16],
  " ": [0, 0, 0, 0, 0, 0, 0],
};

/** "Ventilação, Janelas" → "VENTILACAO, JANELAS" (só o que a fonte tem). */
export function textoDaFonte(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .split("")
    .map((c) => (FONTE[c] ? c : " "))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/** Quebra em linhas de até `max` caracteres, sem cortar palavra. */
export function quebrar(texto: string, max: number): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of texto.split(" ")) {
    const junto = atual ? `${atual} ${palavra}` : palavra;
    if (junto.length <= max) atual = junto;
    else {
      if (atual) linhas.push(atual);
      atual = palavra.slice(0, max);
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

type Rgb = [number, number, number];

/** Matiz (0–360) → cor suave, para cada ambiente ter o seu tom. */
function cor(matiz: number, luz: number): Rgb {
  const c = (1 - Math.abs(2 * luz - 1)) * 0.45;
  const x = c * (1 - Math.abs(((matiz / 60) % 2) - 1));
  const m = luz - c / 2;
  const [r, g, b] =
    matiz < 60
      ? [c, x, 0]
      : matiz < 120
        ? [x, c, 0]
        : matiz < 180
          ? [0, c, x]
          : matiz < 240
            ? [0, x, c]
            : matiz < 300
              ? [x, 0, c]
              : [c, 0, x];
  return [r, g, b].map((v) => Math.round((v + m) * 255)) as Rgb;
}

/** Pixels RGB da foto de exemplo (degradê, textura e o nome embaixo). */
export function desenharFoto(titulo: string, semente: number): Uint8Array {
  const px = new Uint8Array(LARGURA * ALTURA * 3);
  const matiz = semente % 360;
  const topo = cor(matiz, 0.78);
  const base = cor((matiz + 40) % 360, 0.45);
  for (let y = 0; y < ALTURA; y++) {
    const t = y / (ALTURA - 1);
    for (let x = 0; x < LARGURA; x++) {
      // Linhas diagonais leves: lembra a textura de uma parede.
      const textura = (x + y) % 24 < 2 ? -10 : 0;
      const i = (y * LARGURA + x) * 3;
      for (let k = 0; k < 3; k++)
        px[i + k] = Math.max(
          0,
          Math.round((topo[k] ?? 0) * (1 - t) + (base[k] ?? 0) * t) + textura,
        );
    }
  }
  // Faixa escura com o texto, como a legenda de uma foto de vistoria.
  const faixa = 96;
  for (let y = ALTURA - faixa; y < ALTURA; y++)
    for (let x = 0; x < LARGURA; x++) {
      const i = (y * LARGURA + x) * 3;
      for (let k = 0; k < 3; k++)
        px[i + k] = Math.round((px[i + k] ?? 0) * 0.35);
    }
  const linhas = quebrar(textoDaFonte(titulo), 25).slice(0, 2);
  linhas.forEach((linha, n) => {
    escrever(px, linha, 16, ALTURA - faixa + 14 + n * 26, 3);
  });
  escrever(px, "FOTO DE EXEMPLO", 16, ALTURA - 20, 2);
  return px;
}

function escrever(
  px: Uint8Array,
  texto: string,
  x0: number,
  y0: number,
  escala: number,
) {
  [...texto].forEach((c, n) => {
    const glifo = FONTE[c] ?? FONTE[" "] ?? [];
    glifo.forEach((linha, gy) => {
      for (let gx = 0; gx < 5; gx++) {
        if (!(linha & (1 << (4 - gx)))) continue;
        for (let dy = 0; dy < escala; dy++)
          for (let dx = 0; dx < escala; dx++) {
            const x = x0 + (n * 6 + gx) * escala + dx;
            const y = y0 + gy * escala + dy;
            if (x >= LARGURA || y >= ALTURA) continue;
            const i = (y * LARGURA + x) * 3;
            px[i] = 255;
            px[i + 1] = 255;
            px[i + 2] = 255;
          }
      }
    });
  });
}

// ---------------------------------------------------------------------------
// PNG
// ---------------------------------------------------------------------------

function bloco(tipo: string, dados: Uint8Array): Uint8Array {
  const saida = new Uint8Array(12 + dados.length);
  const v = new DataView(saida.buffer);
  v.setUint32(0, dados.length);
  for (let i = 0; i < 4; i++) saida[4 + i] = tipo.charCodeAt(i);
  saida.set(dados, 8);
  v.setUint32(8 + dados.length, crc32(saida.subarray(4, 8 + dados.length)));
  return saida;
}

async function comprimir(bytes: Uint8Array): Promise<Uint8Array> {
  const fluxo = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

/** RGB → PNG (8 bits, sem filtro: o deflate dá conta do degradê). */
export async function codificarPng(
  rgb: Uint8Array,
  largura = LARGURA,
  altura = ALTURA,
): Promise<Uint8Array> {
  const cru = new Uint8Array(altura * (1 + largura * 3));
  for (let y = 0; y < altura; y++)
    cru.set(
      rgb.subarray(y * largura * 3, (y + 1) * largura * 3),
      y * (1 + largura * 3) + 1,
    );
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, largura);
  v.setUint32(4, altura);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const partes = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    bloco("IHDR", ihdr),
    bloco("IDAT", await comprimir(cru)),
    bloco("IEND", new Uint8Array()),
  ];
  const png = new Uint8Array(partes.reduce((t, p) => t + p.length, 0));
  let pos = 0;
  for (const p of partes) {
    png.set(p, pos);
    pos += p.length;
  }
  return png;
}

/** A foto pronta para o bucket. */
export async function fotoDeExemplo(
  titulo: string,
  semente: number,
): Promise<Uint8Array> {
  return codificarPng(desenharFoto(titulo, semente));
}
