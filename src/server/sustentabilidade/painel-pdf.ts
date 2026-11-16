import "server-only";
import { PDFDocument, type PDFFont, type PDFPage, rgb } from "pdf-lib";
import { formatarNumero } from "@/lib/formato";
import type {
  CartaoDoPainel,
  GraficoDoPainel,
  LinhaDeComparacao,
  SerieDoGrafico,
} from "@/lib/sustentabilidade/painel-montagem";
import {
  CINZA,
  CINZA_ESCURO,
  cor,
  MARGENS,
  MM,
  novaPagina,
  numerarPaginas,
  type Papel,
  prepararPapel,
  quebrarLinhas,
  seguro,
  x,
  y,
} from "@/server/os/pdf/papel-timbrado";

// "Relatório de Sustentabilidade do mês" (spec 4.9): uma página no papel
// timbrado da ARP, com os indicadores do ano até o mês, a comparação com o
// ano anterior e gráficos simples (barras desenhadas no PDF). É para a
// apresentação ao Pedro. Sem valores em reais para quem não os vê (o painel
// já monta sem eles).

const VERDE = cor("#2F7D3D");
const VERDE_CLARO = cor("#E6F2E8");
const PRETO = rgb(0.1, 0.1, 0.1);

const ESQ = MARGENS.lateral;
const LARGURA = 210 - 2 * MARGENS.lateral;

const COR_SERIE: Record<SerieDoGrafico["cor"], ReturnType<typeof cor>> = {
  1: VERDE,
  2: cor("#B8BEC6"),
  3: cor("#1E7DD2"),
  4: cor("#6B7280"),
  5: cor("#D9DDE2"),
  neutro: cor("#9CA3AF"),
};

export interface DadosDoRelatorio {
  /** "Outubro de 2026". */
  mes: string;
  /** "janeiro a outubro de 2026". */
  periodo: string;
  /** "2025". */
  anoAnterior: string;
  /** "16/11/2026 14:30, por Fulano". */
  geradoEm: string;
  cartoes: readonly CartaoDoPainel[];
  comparacao: readonly LinhaDeComparacao[];
  graficos: readonly GraficoDoPainel[];
  equivalencias: readonly { nome: string; texto: string }[];
  /** Fontes com dado de exemplo no período ("Programas", "RCC"). */
  exemplo: readonly string[];
}

/** Texto que a fonte do PDF desenha (sem subscrito nem sinais fora do WinAnsi). */
function limpo(f: PDFFont, texto: string): string {
  return seguro(
    f,
    texto.replace(/₂/g, "2").replace(/≈/g, "~").replace(/\s+/g, " "),
  );
}

function texto(
  p: PDFPage,
  f: PDFFont,
  t: string,
  opc: {
    xMm: number;
    yMm: number;
    tamanho: number;
    cor?: ReturnType<typeof rgb>;
    /** Alinha à direita em xMm. */
    direita?: boolean;
  },
) {
  const s = limpo(f, t);
  const largura = f.widthOfTextAtSize(s, opc.tamanho);
  p.drawText(s, {
    x: opc.direita ? x(opc.xMm) - largura : x(opc.xMm),
    y: y(opc.yMm),
    size: opc.tamanho,
    font: f,
    color: opc.cor ?? PRETO,
  });
}

/** Barras agrupadas por mês; mês sem dado fica vazio. */
function desenharBarras(
  pagina: PDFPage,
  papel: Papel,
  g: GraficoDoPainel,
  area: { xMm: number; topoMm: number; larguraMm: number; alturaMm: number },
) {
  const f = papel.fontes;
  texto(pagina, f.negrito, g.titulo, {
    xMm: area.xMm,
    yMm: area.topoMm + 3,
    tamanho: 8,
  });
  const plotTopo = area.topoMm + 6;
  const plotAltura = area.alturaMm - 6 - 4.5;
  const base = plotTopo + plotAltura;
  const valores = g.series.flatMap((s) =>
    s.valores.filter((v): v is number => v !== null),
  );
  const maximo = Math.max(...valores, 0);
  pagina.drawLine({
    start: { x: x(area.xMm), y: y(base) },
    end: { x: x(area.xMm + area.larguraMm), y: y(base) },
    thickness: 0.5,
    color: CINZA,
  });
  if (maximo > 0)
    texto(
      pagina,
      f.normal,
      `máx. ${formatarNumero(maximo, g.casas)} ${g.unidade}`,
      {
        xMm: area.xMm + area.larguraMm,
        yMm: area.topoMm + 3,
        tamanho: 6.5,
        cor: CINZA,
        direita: true,
      },
    );
  const n = g.meses.length;
  const grupo = area.larguraMm / n;
  const barra = (grupo * 0.8) / g.series.length;
  g.meses.forEach((mes, k) => {
    const x0 = area.xMm + k * grupo + grupo * 0.1;
    g.series.forEach((s, j) => {
      const v = s.valores[k];
      if (v === null || v === undefined || maximo <= 0) return;
      const h = Math.max((v / maximo) * plotAltura, v > 0 ? 0.4 : 0);
      if (h <= 0) return;
      pagina.drawRectangle({
        x: x(x0 + j * barra),
        y: y(base),
        width: barra * MM * 0.9,
        height: h * MM,
        color: COR_SERIE[s.cor],
      });
    });
    texto(pagina, f.normal, mes, {
      xMm: area.xMm + k * grupo + grupo / 2 + 0.6,
      yMm: base + 3.2,
      tamanho: 5.5,
      cor: CINZA,
      direita: true,
    });
  });
  // Legenda (só com mais de uma série).
  if (g.series.length > 1) {
    let xl = area.xMm;
    for (const s of g.series) {
      pagina.drawRectangle({
        x: x(xl),
        y: y(area.topoMm + 5.4),
        width: 2 * MM,
        height: 2 * MM,
        color: COR_SERIE[s.cor],
      });
      texto(pagina, f.normal, s.rotulo, {
        xMm: xl + 2.8,
        yMm: area.topoMm + 5,
        tamanho: 5.8,
        cor: CINZA_ESCURO,
      });
      xl +=
        3.6 +
        f.normal.widthOfTextAtSize(limpo(f.normal, s.rotulo), 5.8) / MM +
        2;
    }
  }
}

/** Gera o PDF de uma página. */
export async function gerarRelatorioDoMes(
  d: DadosDoRelatorio,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Relatório de Sustentabilidade – ${d.mes}`);
  doc.setAuthor("ARP");
  const papel = await prepararPapel(doc);
  const pagina = novaPagina(papel);
  const f = papel.fontes;

  // Título.
  texto(pagina, f.negrito, "Relatório de Sustentabilidade", {
    xMm: ESQ,
    yMm: MARGENS.topo + 4,
    tamanho: 15,
    cor: VERDE,
  });
  texto(
    pagina,
    f.normal,
    `${d.mes} · ${d.periodo} · comparação com ${d.anoAnterior}`,
    { xMm: ESQ, yMm: MARGENS.topo + 10, tamanho: 9, cor: CINZA_ESCURO },
  );
  texto(pagina, f.italico, `Gerado em ${d.geradoEm}`, {
    xMm: ESQ,
    yMm: MARGENS.topo + 14.5,
    tamanho: 7,
    cor: CINZA,
  });

  // Tabela de indicadores: atual × ano anterior × variação.
  const topoTabela = MARGENS.topo + 19;
  const col = {
    indicador: ESQ + 2,
    atual: ESQ + LARGURA - 66,
    anterior: ESQ + LARGURA - 34,
    variacao: ESQ + LARGURA - 2,
  };
  pagina.drawRectangle({
    x: x(ESQ),
    y: y(topoTabela + 6),
    width: LARGURA * MM,
    height: 6 * MM,
    color: VERDE_CLARO,
  });
  const ano = d.periodo.split(" ").at(-1) ?? "";
  texto(pagina, f.negrito, "Indicador", {
    xMm: col.indicador,
    yMm: topoTabela + 4.2,
    tamanho: 8,
  });
  for (const [rotulo, xm] of [
    [ano, col.atual],
    [d.anoAnterior, col.anterior],
    ["Variação", col.variacao],
  ] as const)
    texto(pagina, f.negrito, rotulo, {
      xMm: xm,
      yMm: topoTabela + 4.2,
      tamanho: 8,
      direita: true,
    });
  const linha = 5.1;
  d.comparacao.forEach((l, i) => {
    const yy = topoTabela + 6 + (i + 1) * linha;
    pagina.drawLine({
      start: { x: x(ESQ), y: y(yy + 1.3) },
      end: { x: x(ESQ + LARGURA), y: y(yy + 1.3) },
      thickness: 0.3,
      color: rgb(0.88, 0.88, 0.88),
    });
    texto(pagina, f.normal, l.indicador, {
      xMm: col.indicador,
      yMm: yy,
      tamanho: 8.2,
    });
    const semDado = (v: string) => v.startsWith("sem dado");
    texto(pagina, f.negrito, l.atual, {
      xMm: col.atual,
      yMm: yy,
      tamanho: 8.2,
      direita: true,
      cor: semDado(l.atual) ? CINZA : PRETO,
    });
    texto(pagina, f.normal, l.anterior, {
      xMm: col.anterior,
      yMm: yy,
      tamanho: 8.2,
      direita: true,
      cor: semDado(l.anterior) ? CINZA : CINZA_ESCURO,
    });
    texto(pagina, f.normal, l.variacao, {
      xMm: col.variacao,
      yMm: yy,
      tamanho: 8.2,
      direita: true,
      cor: l.variacao.startsWith("-") ? cor("#B91C1C") : CINZA_ESCURO,
    });
  });

  // Indicadores sem comparação com o ano anterior, em linhas de texto.
  let yy = topoTabela + 6 + (d.comparacao.length + 1) * linha + 3;
  const porChave = new Map(d.cartoes.map((c) => [c.chave, c]));
  const extras: string[] = [];
  const volume = porChave.get("volume_reciclado");
  if (volume?.detalhe) extras.push(`Volume reciclado. ${volume.detalhe}`);
  for (const chave of [
    "participantes_clube",
    "cobertura_entrevistas",
    "ocupacao_coletores",
  ] as const) {
    const c = porChave.get(chave);
    if (c)
      extras.push(
        `${c.titulo}: ${c.valor}${c.detalhe ? ` (${c.detalhe})` : ""}`,
      );
  }
  for (const e of d.equivalencias)
    extras.push(`Equivalência, ${e.nome}: ${e.texto}`);
  for (const t of extras)
    for (const l of quebrarLinhas(
      f.normal,
      8,
      limpo(f.normal, t),
      LARGURA * MM,
    )) {
      texto(pagina, f.normal, l, { xMm: ESQ, yMm: yy, tamanho: 8 });
      yy += 4.1;
    }

  // Gráficos 2 × 2.
  yy += 2;
  const larguraGrafico = (LARGURA - 8) / 2;
  const alturaGrafico = 33;
  d.graficos.slice(0, 4).forEach((g, i) => {
    desenharBarras(pagina, papel, g, {
      xMm: ESQ + (i % 2) * (larguraGrafico + 8),
      topoMm: yy + Math.floor(i / 2) * (alturaGrafico + 3),
      larguraMm: larguraGrafico,
      alturaMm: alturaGrafico,
    });
  });
  yy += 2 * (alturaGrafico + 3);

  // Avisos (mês incompleto, dados de exemplo).
  const avisos = [
    ...d.cartoes.flatMap((c) => (c.aviso ? [c.aviso] : [])),
    ...(d.exemplo.length
      ? [`Dados de exemplo (fictícios): ${d.exemplo.join(", ")}.`]
      : []),
  ];
  for (const a of avisos)
    for (const l of quebrarLinhas(
      f.italico,
      7,
      limpo(f.italico, a),
      LARGURA * MM,
    )) {
      texto(pagina, f.italico, l, {
        xMm: ESQ,
        yMm: yy,
        tamanho: 7,
        cor: cor("#92400E"),
      });
      yy += 3.4;
    }

  numerarPaginas(papel);
  return doc.save();
}
