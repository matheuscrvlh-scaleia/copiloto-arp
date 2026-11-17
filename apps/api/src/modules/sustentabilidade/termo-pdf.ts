import type { TextoDoTermoClube } from "@arp/shared/sustentabilidade/clube-termo";
import { PDFDocument, type PDFImage } from "pdf-lib";
import {
  A4,
  desenharJustificado,
  MARGENS,
  MM,
  novaPagina,
  numerarPaginas,
  PRETO,
  prepararPapel,
  quebrarLinhas,
  seguro,
  x,
  y,
} from "@/infra/pdf/papel-timbrado";

// Termo anual do Clube SustentArp em PDF (spec 4.5), no papel timbrado da
// ARP: data à direita, título centralizado em negrito, texto justificado e as
// duas assinaturas (a da ARP em branco, a do participante com a imagem
// desenhada na tela). Mesmo desenho do termo de energia de Operações; o
// topo respeita a faixa da logo do papel (até 38 mm).

const LATERAL_MM = 30;
const TOPO_MM = Math.max(25, MARGENS.topo);
const TAMANHO = 11;
const ENTRELINHA = TAMANHO * 1.5;
const LARGURA_ASSINATURA_MM = 85;
const ALTURA_IMAGEM = 48;

export async function gerarTermoClubePdf(
  t: TextoDoTermoClube,
  /** PNG da assinatura do participante (assinatura na tela); null: linha em branco. */
  assinaturaPng: Uint8Array | null,
  meta: { titulo: string; autor: string },
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(meta.titulo);
  doc.setAuthor(meta.autor);
  doc.setLanguage("pt-BR");
  const papel = await prepararPapel(doc);
  const f = papel.fontes;
  const esquerda = x(LATERAL_MM);
  const largura = A4.largura - 2 * esquerda;
  const fim = y(297 - MARGENS.base);
  const imagem: PDFImage | null = assinaturaPng
    ? await doc.embedPng(assinaturaPng)
    : null;

  let pagina = novaPagina(papel);
  let yy = y(TOPO_MM) - TAMANHO;
  const caber = (altura: number) => {
    if (yy - altura >= fim) return;
    pagina = novaPagina(papel);
    yy = y(TOPO_MM) - TAMANHO;
  };

  const data = seguro(f.normal, t.data);
  pagina.drawText(data, {
    x: esquerda + largura - f.normal.widthOfTextAtSize(data, TAMANHO),
    y: yy,
    size: TAMANHO,
    font: f.normal,
    color: PRETO,
  });
  yy -= ENTRELINHA * 3;

  const titulo = seguro(f.negrito, t.titulo);
  pagina.drawText(titulo, {
    x: esquerda + (largura - f.negrito.widthOfTextAtSize(titulo, 13)) / 2,
    y: yy,
    size: 13,
    font: f.negrito,
    color: PRETO,
  });
  yy -= ENTRELINHA * 2.5;

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

  // Assinaturas: a da ARP primeiro; a do participante leva a imagem.
  const meio = esquerda + largura / 2;
  const meia = (LARGURA_ASSINATURA_MM * MM) / 2;
  for (const [i, a] of t.assinaturas.entries()) {
    const doParticipante = i === t.assinaturas.length - 1;
    caber(ENTRELINHA * 3 + ALTURA_IMAGEM + TAMANHO * 2.6);
    yy -= ENTRELINHA * 3 + (doParticipante && imagem ? ALTURA_IMAGEM : 0);
    if (doParticipante && imagem) {
      const proporcao = imagem.width / imagem.height;
      const altura = ALTURA_IMAGEM;
      const larg = Math.min(altura * proporcao, meia * 2);
      pagina.drawImage(imagem, {
        x: meio - larg / 2,
        y: yy + 2,
        width: larg,
        height: larg / proporcao,
      });
    }
    pagina.drawLine({
      start: { x: meio - meia, y: yy },
      end: { x: meio + meia, y: yy },
      thickness: 0.6,
      color: PRETO,
    });
    let n = 0;
    for (const [texto, fonte] of [
      [a.nome, f.negrito],
      [a.documento, f.normal],
    ] as const) {
      for (const parte of quebrarLinhas(fonte, 10, texto, largura)) {
        pagina.drawText(parte, {
          x: meio - fonte.widthOfTextAtSize(parte, 10) / 2,
          y: yy - 13 - n * 12.5,
          size: 10,
          font: fonte,
          color: PRETO,
        });
        n++;
      }
    }
    yy -= 13 + n * 12.5;
  }
  if (doc.getPageCount() > 1) numerarPaginas(papel);
  return doc.save();
}
