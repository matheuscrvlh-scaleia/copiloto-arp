import "server-only";
import { PDFDocument, type PDFImage, type PDFPage, rgb } from "pdf-lib";
import { formatarData, formatarNumero } from "@/lib/formato";
import { consumoPorMes } from "@/lib/operacoes/agua-extrato";
import {
  formatarVisor,
  MESES_ABREV,
  ROTULO_TIPO,
  rotuloMes,
} from "@/lib/operacoes/agua-formato";
import {
  CINZA,
  cor,
  MARGENS,
  MM,
  novaPagina,
  numerarPaginas,
  type Papel,
  PRETO,
  prepararPapel,
  quebrarLinhas,
  seguro,
  x,
  y,
} from "@/server/os/pdf/papel-timbrado";
import type { Leitura } from "./agua";

// Extrato histórico de consumo de água em PDF A4, no papel timbrado da ARP
// (spec 4.4, Tela 3, e 4.16 A dos Chamados): cabeçalho, tabela mês a mês,
// gráfico do consumo e as fotos do visor. Valores em reais só para quem tem
// a permissão (a leitura com a sessão já vem sem eles).

const AZUL = cor("#0E7490");
const TRILHO = rgb(0.92, 0.92, 0.92);
const LINHA = rgb(0.85, 0.85, 0.85);
const FIM = 297 - MARGENS.base;
const LARGURA = 210 - 2 * MARGENS.lateral;
const MAX_FOTOS = 12;

export interface FotoDoPdf {
  referencia: string;
  leitura: number | null;
  consumo: number;
  /** Bytes do arquivo (jpg ou png); null quando é exemplo ou não abriu. */
  bytes: Uint8Array | null;
}

export interface DadosExtratoPdf {
  emissao: string;
  locatario: string;
  bloco: string;
  sala: string;
  hidrometro: string;
  filtros: string;
  leituras: Leitura[];
  meses: string[];
  comValores: boolean;
  fotos: FotoDoPdf[];
}

interface Cursor {
  papel: Papel;
  pagina: PDFPage;
  /** mm do topo. */
  mm: number;
}

function texto(
  c: Cursor,
  t: string,
  mmX: number,
  tamanho: number,
  opcoes: {
    negrito?: boolean;
    cor?: ReturnType<typeof rgb>;
    direita?: number;
  } = {},
) {
  const fonte = opcoes.negrito ? c.papel.fontes.negrito : c.papel.fontes.normal;
  const s = seguro(fonte, t);
  const largura = fonte.widthOfTextAtSize(s, tamanho);
  c.pagina.drawText(s, {
    x: opcoes.direita !== undefined ? x(opcoes.direita) - largura : x(mmX),
    y: y(c.mm),
    size: tamanho,
    font: fonte,
    color: opcoes.cor ?? PRETO,
  });
}

/** Garante `altura` mm livres; senão, página nova. */
function espaco(c: Cursor, altura: number): boolean {
  if (c.mm + altura <= FIM) return false;
  c.pagina = novaPagina(c.papel);
  c.mm = MARGENS.topo + 4;
  return true;
}

interface ColunaPdf {
  titulo: string;
  largura: number;
  direita?: boolean;
  valor: (l: Leitura) => string;
}

const n2 = (v: number | null) => (v === null ? "—" : formatarNumero(v, 2));

function colunas(comValores: boolean, comSala: boolean): ColunaPdf[] {
  const lista: ColunaPdf[] = [
    { titulo: "Ref.", largura: 14, valor: (l) => rotuloMes(l.referencia) },
    ...(comSala
      ? [
          {
            titulo: "Hidrômetro",
            largura: 24,
            valor: (l: Leitura) => l.hidrometro,
          },
        ]
      : []),
    {
      titulo: "Data ant.",
      largura: 17,
      valor: (l) => formatarData(l.dataAnterior),
    },
    {
      titulo: "Data atual",
      largura: 17,
      valor: (l) => formatarData(l.dataAtual),
    },
    {
      titulo: "Dias",
      largura: 9,
      direita: true,
      valor: (l) => (l.dias === null ? "—" : String(l.dias)),
    },
    {
      titulo: "Leit. ant.",
      largura: 18,
      direita: true,
      valor: (l) => n2(l.leituraAnterior),
    },
    {
      titulo: "Leit. atual",
      largura: 18,
      direita: true,
      valor: (l) => n2(l.leituraAtual),
    },
    {
      titulo: "Consumo m³",
      largura: 18,
      direita: true,
      valor: (l) => n2(l.consumo),
    },
    {
      titulo: "Fat. m³",
      largura: 15,
      direita: true,
      valor: (l) => n2(l.volume),
    },
    ...(comValores
      ? [
          {
            titulo: "Valor R$",
            largura: 18,
            direita: true,
            valor: (l: Leitura) => n2(l.valor),
          },
        ]
      : []),
    {
      titulo: "Tipo",
      largura: 16,
      valor: (l) => ROTULO_TIPO[l.tipo].replace(" (sem cobrança)", ""),
    },
  ];
  // A última coluna ocupa o que sobrar da largura útil.
  const usado = lista.slice(0, -1).reduce((s, c) => s + c.largura, 0);
  const ultima = lista.at(-1);
  if (ultima) ultima.largura = Math.max(LARGURA - usado, 12);
  return lista;
}

function cabecalhoDaTabela(c: Cursor, cols: ColunaPdf[]) {
  let mx = MARGENS.lateral;
  for (const col of cols) {
    texto(c, col.titulo, mx + 0.5, 7, {
      negrito: true,
      cor: CINZA,
      direita: col.direita ? mx + col.largura - 0.5 : undefined,
    });
    mx += col.largura;
  }
  c.pagina.drawLine({
    start: { x: x(MARGENS.lateral), y: y(c.mm + 1.5) },
    end: { x: x(MARGENS.lateral + LARGURA), y: y(c.mm + 1.5) },
    thickness: 0.6,
    color: PRETO,
  });
  c.mm += 5;
}

function tabela(c: Cursor, d: DadosExtratoPdf) {
  const comSala = new Set(d.leituras.map((l) => l.hidrometro)).size > 1;
  const cols = colunas(d.comValores, comSala);
  espaco(c, 12);
  cabecalhoDaTabela(c, cols);
  for (const l of d.leituras) {
    if (espaco(c, 5)) cabecalhoDaTabela(c, cols);
    let mx = MARGENS.lateral;
    for (const col of cols) {
      let t = col.valor(l);
      const fonte = c.papel.fontes.normal;
      while (
        t.length > 1 &&
        fonte.widthOfTextAtSize(seguro(fonte, t), 7.5) > (col.largura - 1) * MM
      )
        t = `${t.slice(0, -2)}…`;
      texto(c, t, mx + 0.5, 7.5, {
        direita: col.direita ? mx + col.largura - 0.5 : undefined,
      });
      mx += col.largura;
    }
    c.pagina.drawLine({
      start: { x: x(MARGENS.lateral), y: y(c.mm + 1.5) },
      end: { x: x(MARGENS.lateral + LARGURA), y: y(c.mm + 1.5) },
      thickness: 0.3,
      color: LINHA,
    });
    c.mm += 5;
  }
  // Total.
  if (espaco(c, 6)) cabecalhoDaTabela(c, cols);
  let mx = MARGENS.lateral;
  const total = (f: (l: Leitura) => number, casas: number) =>
    formatarNumero(
      d.leituras.reduce((s, l) => s + Math.round(f(l) * 10 ** casas), 0) /
        10 ** casas,
      2,
    );
  for (const col of cols) {
    const v =
      col.titulo === "Ref."
        ? "Total"
        : col.titulo === "Consumo m³"
          ? total((l) => l.consumo, 3)
          : col.titulo === "Fat. m³"
            ? total((l) => l.volume, 3)
            : col.titulo === "Valor R$"
              ? total((l) => l.valor ?? 0, 2)
              : "";
    if (v)
      texto(c, v, mx + 0.5, 7.5, {
        negrito: true,
        direita: col.direita ? mx + col.largura - 0.5 : undefined,
      });
    mx += col.largura;
  }
  c.mm += 8;
}

function grafico(c: Cursor, d: DadosExtratoPdf) {
  const serie = consumoPorMes(d.leituras, d.meses);
  if (!serie.length) return;
  const altura = 38;
  espaco(c, altura + 16);
  texto(c, "CONSUMO POR MÊS (m³)", MARGENS.lateral, 8.5, {
    negrito: true,
    cor: AZUL,
  });
  c.mm += 6;
  const max = Math.max(...serie.map((s) => s.consumo ?? 0), 0);
  const passo = LARGURA / serie.length;
  const barra = Math.min(passo * 0.6, 12);
  const base = c.mm + altura;
  serie.forEach((s, i) => {
    const cx = MARGENS.lateral + passo * i + (passo - barra) / 2;
    const h =
      max > 0 && s.consumo
        ? Math.max((s.consumo / max) * (altura - 6), 0.6)
        : 0;
    c.pagina.drawRectangle({
      x: x(cx),
      y: y(base),
      width: barra * MM,
      height: altura * MM - 6 * MM,
      color: TRILHO,
    });
    if (h)
      c.pagina.drawRectangle({
        x: x(cx),
        y: y(base),
        width: barra * MM,
        height: h * MM,
        color: AZUL,
      });
    const meio = cx + barra / 2;
    const rotulo = `${MESES_ABREV[Number(s.referencia.slice(5, 7)) - 1] ?? ""}/${s.referencia.slice(2, 4)}`;
    const cursor = { ...c, mm: base + 4 };
    const largura = c.papel.fontes.normal.widthOfTextAtSize(rotulo, 6) / MM;
    texto(cursor, rotulo, meio - largura / 2, 6, { cor: CINZA });
    if (s.consumo !== null) {
      const v = formatarNumero(s.consumo, 1);
      const lv = c.papel.fontes.normal.widthOfTextAtSize(v, 6) / MM;
      texto({ ...c, mm: base - h - 1.2 }, v, meio - lv / 2, 6);
    }
  });
  c.mm = base + 10;
}

async function imagem(
  doc: PDFDocument,
  bytes: Uint8Array,
): Promise<PDFImage | null> {
  try {
    if (bytes[0] === 0xff && bytes[1] === 0xd8)
      return await doc.embedJpg(bytes);
    if (bytes[0] === 0x89 && bytes[1] === 0x50)
      return await doc.embedPng(bytes);
  } catch (erro) {
    console.error("foto do extrato da água", erro);
  }
  return null;
}

async function fotos(c: Cursor, d: DadosExtratoPdf) {
  const lista = d.fotos.slice(-MAX_FOTOS);
  if (!lista.length) return;
  espaco(c, 50);
  texto(c, "FOTOS DO VISOR", MARGENS.lateral, 8.5, {
    negrito: true,
    cor: AZUL,
  });
  c.mm += 4;
  const porLinha = 4;
  const gap = 4;
  const largura = (LARGURA - gap * (porLinha - 1)) / porLinha;
  const altura = largura * 0.75;
  for (let i = 0; i < lista.length; i += porLinha) {
    espaco(c, altura + 9);
    for (const [j, f] of lista.slice(i, i + porLinha).entries()) {
      const mx = MARGENS.lateral + j * (largura + gap);
      const img = f.bytes ? await imagem(c.papel.doc, f.bytes) : null;
      if (img) {
        const escala = Math.min(
          (largura * MM) / img.width,
          (altura * MM) / img.height,
        );
        const w = img.width * escala;
        const h = img.height * escala;
        c.pagina.drawImage(img, {
          x: x(mx) + (largura * MM - w) / 2,
          y: y(c.mm + altura) + (altura * MM - h) / 2,
          width: w,
          height: h,
        });
      } else {
        // Exemplo (sem foto de verdade) ou formato que o PDF não abre: o visor desenhado.
        c.pagina.drawRectangle({
          x: x(mx),
          y: y(c.mm + altura),
          width: largura * MM,
          height: altura * MM,
          color: rgb(0.12, 0.16, 0.18),
        });
        const t = `${formatarVisor(f.leitura).padStart(8, "0")} m³`;
        const lt = c.papel.fontes.negrito.widthOfTextAtSize(t, 10) / MM;
        texto(
          { ...c, mm: c.mm + altura / 2 + 1.5 },
          t,
          mx + (largura - lt) / 2,
          10,
          {
            negrito: true,
            cor: rgb(1, 1, 1),
          },
        );
        const aviso = f.bytes ? "foto em outro formato" : "foto de exemplo";
        const la = c.papel.fontes.normal.widthOfTextAtSize(aviso, 6) / MM;
        texto(
          { ...c, mm: c.mm + altura / 2 + 6 },
          aviso,
          mx + (largura - la) / 2,
          6,
          {
            cor: rgb(0.8, 0.8, 0.8),
          },
        );
      }
      texto(
        { ...c, mm: c.mm + altura + 4 },
        `${rotuloMes(f.referencia)} · ${formatarVisor(f.leitura)} m³ · consumo ${formatarNumero(f.consumo, 2)} m³`,
        mx,
        6.5,
        { cor: CINZA },
      );
    }
    c.mm += altura + 9;
  }
  if (d.fotos.length > MAX_FOTOS)
    texto(
      c,
      `Mais ${d.fotos.length - MAX_FOTOS} foto(s) no sistema.`,
      MARGENS.lateral,
      7,
      {
        cor: CINZA,
      },
    );
}

export async function gerarExtratoAgua(
  d: DadosExtratoPdf,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Extrato de consumo de água - ${d.hidrometro || d.sala}`);
  doc.setAuthor("ARP Centralizador");
  const papel = await prepararPapel(doc);
  const c: Cursor = { papel, pagina: novaPagina(papel), mm: MARGENS.topo + 4 };

  texto(
    c,
    "ESPAÇO ARP • EXTRATO HISTÓRICO DE CONSUMO DE ÁGUA",
    MARGENS.lateral,
    12,
    {
      negrito: true,
    },
  );
  c.mm += 7;
  const info = [
    `Emissão: ${d.emissao}`,
    `Locatário: ${d.locatario || "—"}`,
    `Bloco: ${d.bloco || "—"}`,
    `Sala: ${d.sala || "—"}`,
    `Hidrômetro: ${d.hidrometro || "—"}`,
  ].join("   •   ");
  for (const linha of quebrarLinhas(
    papel.fontes.normal,
    8.5,
    info,
    LARGURA * MM,
  )) {
    texto(c, linha, MARGENS.lateral, 8.5);
    c.mm += 4.5;
  }
  if (d.filtros) {
    for (const linha of quebrarLinhas(
      papel.fontes.normal,
      7.5,
      d.filtros,
      LARGURA * MM,
    )) {
      texto(c, linha, MARGENS.lateral, 7.5, { cor: CINZA });
      c.mm += 4;
    }
  }
  c.mm += 3;

  if (d.leituras.length) {
    tabela(c, d);
    grafico(c, d);
    await fotos(c, d);
  } else {
    texto(c, "Nenhuma leitura no período.", MARGENS.lateral, 9, { cor: CINZA });
  }
  numerarPaginas(papel);
  return doc.save();
}
