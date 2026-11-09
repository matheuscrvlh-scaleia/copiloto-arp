import "server-only";
import { PDFDocument, type PDFPage } from "pdf-lib";
import type { TextoDoTermo } from "@/lib/operacoes/termo";
import {
  A4,
  desenharJustificado,
  MARGENS,
  MM,
  novaPagina,
  type Papel,
  PRETO,
  prepararPapel,
  quebrarLinhas,
  seguro,
  x,
  y,
} from "@/server/os/pdf/papel-timbrado";

// Termo de autorização de energia em PDF (spec 4.6): A4 no papel timbrado,
// margens de 3 cm nas laterais, data à direita, título centralizado em
// negrito, texto justificado e as duas assinaturas, uma embaixo da outra.
//
// Topo: a spec pede 2,5 cm, mas o papel timbrado reserva a faixa da logo
// até 38 mm (4.16 A); o texto começa no que for mais baixo, para nunca
// encostar na logo. Embaixo, para antes do rodapé do papel.

export const TERMO_MARGENS_MM = {
  topo: Math.max(25, MARGENS.topo),
  lateral: 30,
  base: MARGENS.base,
} as const;

const TAMANHO = 11;
const ENTRELINHA = TAMANHO * 1.5;
const ASSINATURA_MM = 85;

export async function gerarTermoPdf(
  t: TextoDoTermo,
  meta: { titulo: string; autor: string },
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(meta.titulo);
  doc.setAuthor(meta.autor);
  doc.setLanguage("pt-BR");
  const papel = await prepararPapel(doc);
  const f = papel.fontes;
  const esquerda = x(TERMO_MARGENS_MM.lateral);
  const largura = A4.largura - 2 * esquerda;
  const fim = y(297 - TERMO_MARGENS_MM.base);

  let pagina = novaPagina(papel);
  let yy = y(TERMO_MARGENS_MM.topo) - TAMANHO;
  /** Garante `altura` livre na página; senão, abre outra. */
  const caber = (altura: number) => {
    if (yy - altura >= fim) return;
    pagina = novaPagina(papel);
    yy = y(TERMO_MARGENS_MM.topo) - TAMANHO;
  };

  // Data alinhada à direita.
  const data = seguro(f.normal, t.data);
  pagina.drawText(data, {
    x: esquerda + largura - f.normal.widthOfTextAtSize(data, TAMANHO),
    y: yy,
    size: TAMANHO,
    font: f.normal,
    color: PRETO,
  });
  yy -= ENTRELINHA * 3;

  // Título centralizado, em negrito.
  const titulo = seguro(f.negrito, t.titulo);
  pagina.drawText(titulo, {
    x: esquerda + (largura - f.negrito.widthOfTextAtSize(titulo, 13)) / 2,
    y: yy,
    size: 13,
    font: f.negrito,
    color: PRETO,
  });
  yy -= ENTRELINHA * 2.5;

  // Parágrafos justificados.
  for (const p of t.paragrafos) {
    const linhas = quebrarLinhas(f.normal, TAMANHO, p, largura).length;
    caber(linhas * ENTRELINHA);
    yy = desenharJustificado(pagina, f.normal, TAMANHO, p, {
      x: esquerda,
      y: yy,
      largura,
      entrelinha: ENTRELINHA,
    });
    yy -= ENTRELINHA * 0.6;
  }

  // Assinaturas: linha, nome e documento, centralizados.
  for (const a of t.assinaturas) {
    const bloco = ENTRELINHA * 4 + TAMANHO * 2.6;
    caber(bloco);
    yy -= ENTRELINHA * 4;
    const linhas = assinatura(pagina, papel, a, esquerda, largura, yy);
    yy -= 13 + linhas * 12.5;
  }
  return doc.save();
}

/** Desenha a assinatura; devolve quantas linhas de texto usou. */
function assinatura(
  pagina: PDFPage,
  { fontes: f }: Papel,
  a: { nome: string; documento: string },
  esquerda: number,
  largura: number,
  yLinha: number,
): number {
  const meio = esquerda + largura / 2;
  const meia = (ASSINATURA_MM * MM) / 2;
  pagina.drawLine({
    start: { x: meio - meia, y: yLinha },
    end: { x: meio + meia, y: yLinha },
    thickness: 0.6,
    color: PRETO,
  });
  const linhas = [
    { texto: a.nome, fonte: f.negrito },
    { texto: a.documento, fonte: f.normal },
  ];
  let n = 0;
  for (const { texto, fonte } of linhas) {
    // Nome longo: quebra em mais linhas dentro da largura da assinatura.
    for (const parte of quebrarLinhas(fonte, 10, texto, largura)) {
      pagina.drawText(parte, {
        x: meio - fonte.widthOfTextAtSize(parte, 10) / 2,
        y: yLinha - 13 - n * 12.5,
        size: 10,
        font: fonte,
        color: PRETO,
      });
      n++;
    }
  }
  return n;
}
