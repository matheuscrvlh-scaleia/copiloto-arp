import "server-only";
import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  rgb,
  StandardFonts,
} from "pdf-lib";
import {
  type IndicadoresCenso,
  type LinhaGrupo,
  VAZIO,
} from "@/lib/comercial/censo";
import { formatarMoeda, formatarNumero, formatarPct } from "@/lib/formato";
import { LOGO_PNG_BASE64 } from "@/server/os/pdf/logo";
import { A4, cor, MM, seguro } from "@/server/os/pdf/papel-timbrado";

// Panorama do Censo numa folha A4 (spec 4.8, "no lugar do mapa mental"):
// os quatro números da rodada, os indicadores, os rankings por segmento e
// por bloco, a movimentação por segmento e as expectativas, com o rótulo de
// dado estimado. Cada ranking mostra até as linhas que cabem.

const VERDE = cor("#2F7D3D");
const CINZA = rgb(0.42, 0.42, 0.42);
const TRILHO = rgb(0.92, 0.92, 0.92);
const ESCURO = rgb(0.1, 0.1, 0.1);
const MARGEM = 14 * MM;
const LARGURA = A4.largura - 2 * MARGEM;

export interface DadosPanorama {
  rodada: string;
  filtros: string;
  geradoEm: string;
  rotulo: string;
  indicadores: IndicadoresCenso;
  segmentos: LinhaGrupo[];
  blocos: LinhaGrupo[];
}

interface Fontes {
  normal: PDFFont;
  negrito: PDFFont;
}

function texto(
  p: PDFPage,
  f: PDFFont,
  t: string,
  x: number,
  y: number,
  tamanho: number,
  corTexto = ESCURO,
  largura?: number,
) {
  let s = seguro(f, t);
  if (largura)
    while (s.length > 1 && f.widthOfTextAtSize(s, tamanho) > largura)
      s = `${s.slice(0, -2)}…`;
  p.drawText(s, { x, y, size: tamanho, font: f, color: corTexto });
}

function titulo(
  p: PDFPage,
  f: Fontes,
  t: string,
  x: number,
  y: number,
  largura: number,
) {
  texto(p, f.negrito, t.toUpperCase(), x, y, 8.5, VERDE);
  p.drawLine({
    start: { x, y: y - 3 },
    end: { x: x + largura, y: y - 3 },
    thickness: 0.6,
    color: VERDE,
  });
}

/** Barras deitadas: rótulo, trilho e valor; devolve o y de baixo. */
function barras(
  p: PDFPage,
  f: Fontes,
  itens: { rotulo: string; valor: number; texto: string }[],
  x: number,
  y: number,
  largura: number,
  maxLinhas: number,
): number {
  const max = Math.max(...itens.map((i) => i.valor), 0);
  const rotuloL = largura * 0.45;
  const valorL = largura * 0.17;
  const trilho = largura - rotuloL - valorL - 8;
  let yy = y;
  for (const i of itens.slice(0, maxLinhas)) {
    texto(p, f.normal, i.rotulo, x, yy, 7.5, ESCURO, rotuloL - 4);
    p.drawRectangle({
      x: x + rotuloL,
      y: yy - 1,
      width: trilho,
      height: 6,
      color: TRILHO,
    });
    if (max > 0)
      p.drawRectangle({
        x: x + rotuloL,
        y: yy - 1,
        width: Math.max((i.valor / max) * trilho, 1),
        height: 6,
        color: VERDE,
      });
    const v = seguro(f.negrito, i.texto);
    p.drawText(v, {
      x: x + largura - f.negrito.widthOfTextAtSize(v, 7.5),
      y: yy,
      size: 7.5,
      font: f.negrito,
      color: ESCURO,
    });
    yy -= 11.5;
  }
  if (itens.length > maxLinhas)
    texto(
      p,
      f.normal,
      `+ ${itens.length - maxLinhas} na tela`,
      x,
      yy,
      7,
      CINZA,
    );
  return yy - 4;
}

const bloco = (g: string) => (g === VAZIO ? VAZIO : `Bloco ${g}`);

export async function gerarPanoramaCenso(
  d: DadosPanorama,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Panorama do ${d.rodada}`);
  doc.setAuthor("ARP");
  const [normal, negrito, logo] = await Promise.all([
    doc.embedFont(StandardFonts.Helvetica),
    doc.embedFont(StandardFonts.HelveticaBold),
    doc.embedPng(LOGO_PNG_BASE64),
  ]);
  const f: Fontes = { normal, negrito };
  const p = doc.addPage([A4.largura, A4.altura]);
  const i = d.indicadores;

  // Topo
  const lw = 24 * MM;
  const lh = (lw * logo.height) / logo.width;
  p.drawImage(logo, {
    x: MARGEM,
    y: A4.altura - 11 * MM - lh,
    width: lw,
    height: lh,
  });
  const t = `Panorama do ${d.rodada}`;
  texto(
    p,
    negrito,
    t,
    A4.largura - MARGEM - negrito.widthOfTextAtSize(seguro(negrito, t), 16),
    A4.altura - 19 * MM,
    16,
  );
  const sub = `${d.filtros} · ${d.geradoEm}`;
  texto(
    p,
    normal,
    sub,
    A4.largura -
      MARGEM -
      Math.min(
        normal.widthOfTextAtSize(seguro(normal, sub), 7.5),
        LARGURA * 0.7,
      ),
    A4.altura - 25 * MM,
    7.5,
    CINZA,
    LARGURA * 0.7,
  );
  let y = A4.altura - 32 * MM;
  p.drawRectangle({
    x: MARGEM,
    y: y - 4,
    width: LARGURA,
    height: 14,
    color: rgb(1, 0.96, 0.85),
  });
  texto(p, normal, d.rotulo, MARGEM + 6, y, 8, rgb(0.45, 0.3, 0.02));
  y -= 18;

  // Quatro números
  const cartoes: [string, string, string][] = [
    ["Empresas respondentes", formatarNumero(i.empresas), "sem duplicadas"],
    [
      "Colaboradores na ARP",
      formatarNumero(i.colaboradores),
      `média ${i.mediaColaboradores === null ? "—" : formatarNumero(i.mediaColaboradores, 1)} · mediana ${i.medianaColaboradores === null ? "—" : formatarNumero(i.medianaColaboradores, Number.isInteger(i.medianaColaboradores) ? 0 : 1)}`,
    ],
    [
      "Visitantes por dia",
      formatarNumero(i.visitantes),
      `${formatarNumero(i.pessoas)} pessoas no total`,
    ],
    [
      "Movimentação diária estimada",
      formatarMoeda(i.movimentacao, 0),
      `ticket médio ${i.ticketMedio === null ? "—" : formatarMoeda(i.ticketMedio)}`,
    ],
  ];
  const cw = (LARGURA - 3 * 6) / 4;
  cartoes.forEach(([k, v, s], n) => {
    const x = MARGEM + n * (cw + 6);
    p.drawRectangle({
      x,
      y: y - 46,
      width: cw,
      height: 50,
      color: n === 0 ? ESCURO : rgb(0.96, 0.97, 0.96),
    });
    const claro = n === 0 ? rgb(1, 1, 1) : ESCURO;
    texto(
      p,
      normal,
      k,
      x + 7,
      y - 8,
      7.5,
      n === 0 ? rgb(0.8, 0.8, 0.8) : CINZA,
      cw - 14,
    );
    texto(p, negrito, v, x + 7, y - 26, 15, claro, cw - 14);
    texto(
      p,
      normal,
      s,
      x + 7,
      y - 39,
      7,
      n === 0 ? rgb(0.8, 0.8, 0.8) : CINZA,
      cw - 14,
    );
  });
  y -= 64;

  // Duas colunas
  const col = (LARGURA - 10) / 2;
  const xe = MARGEM;
  const xd = MARGEM + col + 10;

  titulo(p, f, "Visitantes por dia, por segmento", xe, y, col);
  const ye1 = barras(
    p,
    f,
    [...d.segmentos]
      .sort((a, b) => b.visitantes - a.visitantes)
      .map((g) => ({
        rotulo: g.grupo,
        valor: g.visitantes,
        texto: formatarNumero(g.visitantes),
      })),
    xe,
    y - 14,
    col,
    10,
  );
  titulo(p, f, "Visitantes por dia, por bloco", xd, y, col);
  const yd1 = barras(
    p,
    f,
    [...d.blocos]
      .sort((a, b) => b.visitantes - a.visitantes)
      .map((g) => ({
        rotulo: bloco(g.grupo),
        valor: g.visitantes,
        texto: formatarNumero(g.visitantes),
      })),
    xd,
    y - 14,
    col,
    14,
  );
  y = Math.min(ye1, yd1) - 10;

  titulo(p, f, "Movimentação diária por segmento", xe, y, col);
  const ye2 = barras(
    p,
    f,
    [...d.segmentos]
      .sort((a, b) => b.movimentacao - a.movimentacao)
      .map((g) => ({
        rotulo: g.grupo,
        valor: g.movimentacao,
        texto: formatarMoeda(g.movimentacao, 0),
      })),
    xe,
    y - 14,
    col,
    10,
  );
  titulo(p, f, "Empresas por segmento", xd, y, col);
  const yd2 = barras(
    p,
    f,
    [...d.segmentos]
      .sort((a, b) => b.empresas - a.empresas)
      .map((g) => ({
        rotulo: g.grupo,
        valor: g.empresas,
        texto: formatarNumero(g.empresas),
      })),
    xd,
    y - 14,
    col,
    10,
  );
  y = Math.min(ye2, yd2) - 10;

  titulo(p, f, "Expectativas para o ano (aceita mais de uma)", xe, y, col);
  barras(
    p,
    f,
    i.expectativas.map((e) => ({
      rotulo: e.opcao,
      valor: e.pct,
      texto: formatarPct(e.pct, 0),
    })),
    xe,
    y - 14,
    col,
    6,
  );
  titulo(p, f, "Indicadores", xd, y, col);
  let yi = y - 14;
  for (const [k, v] of [
    ["Pessoas por dia no total", formatarNumero(i.pessoas)],
    ["Empresas com atendimento ao público", formatarPct(i.pctAtendimento, 2)],
    [
      "Ticket médio geral (ponderado)",
      i.ticketMedio === null ? "—" : formatarMoeda(i.ticketMedio),
    ],
    ["Conversões por dia (com ticket)", formatarNumero(i.conversoes)],
  ] as const) {
    texto(p, normal, k, xd, yi, 7.5, ESCURO, col * 0.7);
    const s = seguro(negrito, v);
    p.drawText(s, {
      x: xd + col - negrito.widthOfTextAtSize(s, 7.5),
      y: yi,
      size: 7.5,
      font: negrito,
      color: ESCURO,
    });
    yi -= 11.5;
  }

  texto(p, negrito, "Arp. Onde tudo acontece", MARGEM, 9 * MM, 7, CINZA);
  texto(
    p,
    normal,
    "Fonte: questionário do Censo (respostas das empresas)",
    A4.largura -
      MARGEM -
      normal.widthOfTextAtSize(
        "Fonte: questionário do Censo (respostas das empresas)",
        7,
      ),
    9 * MM,
    7,
    CINZA,
  );
  return doc.save();
}
