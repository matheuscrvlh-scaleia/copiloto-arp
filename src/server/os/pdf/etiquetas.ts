import "server-only";
import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  rgb,
  StandardFonts,
} from "pdf-lib";
import QRCode from "qrcode";
import { A4, CINZA, MM, PRETO, quebrarLinhas, seguro } from "./papel-timbrado";

// Etiquetas QR dos ativos em lote: grade A4 de 3 × 8 (70 × 37 mm, a folha
// adesiva mais comum), sem papel timbrado. Cada etiqueta tem o QR (que abre
// a ficha no celular de quem já está logado), o código, o nome e o local.
// O QR é desenhado em vetor, módulo a módulo: sai nítido em qualquer
// impressora.

export const GRADE = {
  colunas: 3,
  linhas: 8,
  largura: 70,
  altura: 37,
} as const;
export const POR_FOLHA = GRADE.colunas * GRADE.linhas;

const MARGEM = {
  x: (210 - GRADE.colunas * GRADE.largura) / 2,
  y: (297 - GRADE.linhas * GRADE.altura) / 2,
};
const RESPIRO = 3;

export interface Etiqueta {
  codigo: string;
  nome: string;
  local: string;
  /** Endereço que o QR abre. */
  url: string;
}

/** Quadrados escuros do QR, juntando os vizinhos da mesma linha. */
function desenharQr(
  pagina: PDFPage,
  texto: string,
  esquerda: number,
  topo: number,
  lado: number,
) {
  const { modules } = QRCode.create(texto, { errorCorrectionLevel: "M" });
  const n = modules.size;
  const modulo = lado / n;
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!modules.data[r * n + c]) {
        c++;
        continue;
      }
      const inicio = c;
      while (c < n && modules.data[r * n + c]) c++;
      pagina.drawRectangle({
        x: esquerda + inicio * modulo,
        // Um fio a mais na altura: sem linhas brancas entre as fileiras.
        y: topo - (r + 1) * modulo - 0.05,
        width: (c - inicio) * modulo,
        height: modulo + 0.1,
        color: PRETO,
      });
    }
  }
}

function texto(
  pagina: PDFPage,
  linhas: string[],
  fonte: PDFFont,
  tamanho: number,
  esquerda: number,
  topo: number,
  cor = PRETO,
): number {
  let y = topo;
  for (const l of linhas) {
    y -= tamanho * 1.15;
    pagina.drawText(l, {
      x: esquerda,
      y,
      size: tamanho,
      font: fonte,
      color: cor,
    });
  }
  return y;
}

/** Até `max` linhas; a última ganha reticências se sobrar texto. */
function cortar(
  fonte: PDFFont,
  tamanho: number,
  t: string,
  largura: number,
  max: number,
): string[] {
  const linhas = quebrarLinhas(fonte, tamanho, t, largura).filter(Boolean);
  if (linhas.length <= max) return linhas;
  const ultima = linhas[max - 1] ?? "";
  let curta = ultima;
  while (
    curta.length > 1 &&
    fonte.widthOfTextAtSize(`${curta}…`, tamanho) > largura
  )
    curta = curta.slice(0, -1);
  return [...linhas.slice(0, max - 1), `${curta.trimEnd()}…`];
}

/**
 * PDF das etiquetas. `inicio` (1 = primeira) pula as posições já usadas da
 * primeira folha.
 */
export async function gerarEtiquetas(
  etiquetas: Etiqueta[],
  inicio = 1,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Etiquetas de ativos");
  doc.setCreator("ARP Centralizador");
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const pulo = Math.min(Math.max(1, Math.floor(inicio)), POR_FOLHA) - 1;

  let pagina: PDFPage | null = null;
  for (const [i, e] of etiquetas.entries()) {
    const posicao = (i + pulo) % POR_FOLHA;
    if (!pagina || posicao === 0) pagina = doc.addPage([A4.largura, A4.altura]);
    const col = posicao % GRADE.colunas;
    const lin = Math.floor(posicao / GRADE.colunas);
    const esquerda = (MARGEM.x + col * GRADE.largura) * MM;
    const topo = A4.altura - (MARGEM.y + lin * GRADE.altura) * MM;

    const lado = (GRADE.altura - RESPIRO * 2) * MM;
    desenharQr(
      pagina,
      e.url,
      esquerda + RESPIRO * MM,
      topo - RESPIRO * MM,
      lado,
    );

    const xTexto = esquerda + RESPIRO * MM + lado + 2.5 * MM;
    const largura = esquerda + (GRADE.largura - RESPIRO) * MM - xTexto;
    let y = topo - (RESPIRO + 1) * MM;
    y = texto(pagina, [seguro(negrito, e.codigo)], negrito, 11, xTexto, y);
    y -= 1 * MM;
    y = texto(
      pagina,
      cortar(negrito, 8, e.nome, largura, 3),
      negrito,
      8,
      xTexto,
      y,
    );
    y -= 0.8 * MM;
    texto(
      pagina,
      cortar(normal, 6.5, e.local, largura, 2),
      normal,
      6.5,
      xTexto,
      y,
      CINZA,
    );
    pagina.drawText(seguro(normal, "ARP · Ativos"), {
      x: xTexto,
      y: topo - (GRADE.altura - RESPIRO) * MM,
      size: 5.5,
      font: normal,
      color: rgb(0.6, 0.6, 0.6),
    });
  }
  if (!etiquetas.length) doc.addPage([A4.largura, A4.altura]);
  return doc.save();
}
