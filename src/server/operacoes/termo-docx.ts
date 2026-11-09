import "server-only";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Header,
  HorizontalPositionRelativeFrom,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
  TextWrappingType,
  VerticalPositionRelativeFrom,
} from "docx";
import type { TextoDoTermo } from "@/lib/operacoes/termo";
import { baixarArquivo } from "@/server/os/base";
import { LOGO_PNG_BASE64 } from "@/server/os/pdf/logo";
import { CAMINHOS_PAPEL_TIMBRADO } from "@/server/os/pdf/papel-timbrado";
import { TERMO_MARGENS_MM } from "./termo-pdf";

// Termo de autorização de energia em Word (spec 4.6), com o mesmo texto e
// o mesmo layout do PDF: A4, margens iguais, data à direita, título
// centralizado em negrito, texto justificado e as duas assinaturas. Com a
// imagem oficial do papel timbrado (Parâmetros dos Chamados), ela vai
// atrás do texto em página inteira; sem ela, a logo da ARP no cabeçalho.

const EMU_POR_MM = 36_000;
const PX_POR_MM = 96 / 25.4;
const TWIP_POR_MM = 1440 / 25.4;
const A4_MM = { largura: 210, altura: 297 } as const;
const FONTE = "Arial";
/** Meios pontos (11 pt) e entrelinha 1,5. */
const TAMANHO = 22;
const ENTRELINHA = 360;

const twip = (mm: number) => Math.round(mm * TWIP_POR_MM);

/** Largura e altura (px) de um PNG pelo cabeçalho IHDR. */
function tamanhoDoPng(png: Uint8Array): { largura: number; altura: number } {
  const v = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { largura: v.getUint32(16), altura: v.getUint32(20) };
}

async function fundoOficial(): Promise<{
  dados: Uint8Array;
  tipo: "png" | "jpg";
} | null> {
  for (const caminho of CAMINHOS_PAPEL_TIMBRADO) {
    const dados = await baixarArquivo(caminho);
    if (dados?.length)
      return { dados, tipo: caminho.endsWith(".png") ? "png" : "jpg" };
  }
  return null;
}

/** Imagem solta na página, atrás do texto, a partir de (x, y) em mm. */
function imagemNaPagina(
  imagem: { dados: Uint8Array; tipo: "png" | "jpg" },
  mm: { x: number; y: number; largura: number; altura: number },
  descricao: string,
): ImageRun {
  return new ImageRun({
    type: imagem.tipo,
    data: imagem.dados,
    transformation: {
      width: Math.round(mm.largura * PX_POR_MM),
      height: Math.round(mm.altura * PX_POR_MM),
    },
    altText: { name: descricao, description: descricao, title: descricao },
    floating: {
      horizontalPosition: {
        relative: HorizontalPositionRelativeFrom.PAGE,
        offset: Math.round(mm.x * EMU_POR_MM),
      },
      verticalPosition: {
        relative: VerticalPositionRelativeFrom.PAGE,
        offset: Math.round(mm.y * EMU_POR_MM),
      },
      behindDocument: true,
      allowOverlap: true,
      wrap: { type: TextWrappingType.NONE },
    },
  });
}

async function cabecalho(): Promise<Header> {
  const fundo = await fundoOficial();
  if (fundo)
    return new Header({
      children: [
        new Paragraph({
          children: [
            imagemNaPagina(
              fundo,
              { x: 0, y: 0, largura: A4_MM.largura, altura: A4_MM.altura },
              "Papel timbrado da ARP",
            ),
          ],
        }),
      ],
    });
  // Mesma posição e largura da logo no papel desenhado do PDF.
  const logo = Uint8Array.from(Buffer.from(LOGO_PNG_BASE64, "base64"));
  const { largura, altura } = tamanhoDoPng(logo);
  const larguraMm = 32;
  return new Header({
    children: [
      new Paragraph({
        children: [
          imagemNaPagina(
            { dados: logo, tipo: "png" },
            {
              x: 27.5,
              y: 14,
              largura: larguraMm,
              altura: (larguraMm * altura) / largura,
            },
            "Logo da ARP",
          ),
        ],
      }),
    ],
  });
}

const texto = (t: string, negrito = false) =>
  new TextRun({ text: t, bold: negrito, font: FONTE, size: TAMANHO });

export async function gerarTermoDocx(
  t: TextoDoTermo,
  meta: { titulo: string; autor: string },
): Promise<Uint8Array> {
  const espaco = { line: ENTRELINHA, after: 160 };
  const assinaturas = t.assinaturas.flatMap((a) => [
    new Paragraph({
      spacing: { before: 960, line: 276 },
      indent: { left: twip(32), right: twip(32) },
      alignment: AlignmentType.CENTER,
      keepNext: true,
      keepLines: true,
      border: {
        top: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 4 },
      },
      children: [texto(a.nome, true)],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: 276 },
      keepLines: true,
      children: [texto(a.documento)],
    }),
  ]);
  const doc = new Document({
    title: meta.titulo,
    creator: meta.autor,
    styles: {
      default: {
        document: { run: { font: FONTE, size: TAMANHO } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: twip(A4_MM.largura), height: twip(A4_MM.altura) },
            margin: {
              top: twip(TERMO_MARGENS_MM.topo),
              bottom: twip(TERMO_MARGENS_MM.base),
              left: twip(TERMO_MARGENS_MM.lateral),
              right: twip(TERMO_MARGENS_MM.lateral),
              header: twip(10),
            },
          },
        },
        headers: { default: await cabecalho() },
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { ...espaco, after: 720 },
            children: [texto(t.data)],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { ...espaco, after: 480 },
            children: [
              new TextRun({
                text: t.titulo,
                bold: true,
                font: FONTE,
                size: 26,
              }),
            ],
          }),
          ...t.paragrafos.map(
            (p) =>
              new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                spacing: espaco,
                children: [texto(p)],
              }),
          ),
          ...assinaturas,
        ],
      },
    ],
  });
  return new Uint8Array(await Packer.toBuffer(doc));
}
