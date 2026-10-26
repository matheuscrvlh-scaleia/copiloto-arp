import "server-only";
import { PDFDocument } from "pdf-lib";
import { formatarMoeda } from "@/lib/formato";
import {
  arquivoAbertas,
  COLUNAS_ABERTAS,
  emitidoEm,
  linhaAberta,
  type OSRelatorio,
  STATUS_EM_ABERTO,
} from "@/lib/os/relatorios";
import { contexto } from "../base";
import { cadastros, consultarOS, paraRelatorio } from "../ordem-consulta";
import {
  CINZA,
  cor,
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
} from "../pdf/papel-timbrado";
import {
  cabecalho,
  colunas,
  faixa,
  linhas,
  MOEDA,
  novoLivro,
  paraBytes,
} from "./planilha";

// OS em aberto (spec 4.16 D): Aberto, Em andamento e Aguardando, como
// estão agora. "DASHBOARD DE O.S. ABERTAS" em Excel e em PDF no papel
// timbrado. Valor só com os.custos.

async function abertas(): Promise<{ oss: OSRelatorio[]; comCustos: boolean }> {
  const [ctx, cad, lista] = await Promise.all([
    contexto(),
    cadastros(),
    consultarOS({ status: STATUS_EM_ABERTO, limite: 5000 }),
  ]);
  const comCustos = ctx.pode("os.custos");
  return {
    comCustos,
    oss: [...lista]
      .sort((a, b) => a.numero - b.numero)
      .map((o) => paraRelatorio(o, cad, comCustos)),
  };
}

export async function planilhaDeAbertas(
  agora: Date,
): Promise<{ bytes: Uint8Array; nome: string }> {
  const { oss } = await abertas();
  const livro = novoLivro();
  const aba = livro.addWorksheet("O.S. ABERTAS", {
    views: [{ state: "frozen", ySplit: 3 }],
  });
  const n = COLUNAS_ABERTAS.length;
  faixa(aba, 1, 1, n, "DASHBOARD DE O.S. ABERTAS", "titulo");
  faixa(aba, 2, 1, n, emitidoEm(agora), "nota");
  cabecalho(aba, 3, 1, COLUNAS_ABERTAS);
  linhas(aba, 4, 1, oss.map(linhaAberta));
  aba.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: n } };
  colunas(aba, [
    { largura: 8 },
    { largura: 14 },
    { largura: 18 },
    { largura: 8 },
    { largura: 28, quebra: true },
    { largura: 56, quebra: true },
    { largura: 11 },
    { largura: 11 },
    { largura: 14, formato: MOEDA },
    { largura: 60, quebra: true },
  ]);
  return { bytes: await paraBytes(livro), nome: arquivoAbertas(agora, "xlsx") };
}

const AZUL = cor("#0B3C72");
const LINHA = cor("#E5E5E5");
const LARGURA = 210 - 2 * MARGENS.lateral;
/** Fim da área útil: antes do rodapé do papel timbrado (endereço, 252 mm). */
const LIMITE = Math.min(297 - MARGENS.base, 249);

/**
 * PDF no papel timbrado (retrato): cada OS em um bloco de três linhas —
 * os números na primeira, técnicos e períodos na segunda, a descrição na
 * terceira — para caber sem letra miúda.
 */
export async function pdfDeAbertas(
  agora: Date,
): Promise<{ bytes: Uint8Array; nome: string }> {
  const doc = await PDFDocument.create();
  doc.setTitle("DASHBOARD DE O.S. ABERTAS");
  // As OS e o papel timbrado (arquivo no bucket) saem juntos.
  const [{ oss, comCustos }, papel] = await Promise.all([
    abertas(),
    prepararPapel(doc),
  ]);
  const { normal, negrito } = papel.fontes;
  let pagina = novaPagina(papel);
  let atual = MARGENS.topo;

  const texto = (
    t: string,
    xmm: number,
    o: { tamanho?: number; fonte?: typeof normal; cor?: typeof PRETO } = {},
  ) =>
    pagina.drawText(seguro(o.fonte ?? normal, t), {
      x: x(xmm),
      y: y(atual),
      size: o.tamanho ?? 8,
      font: o.fonte ?? normal,
      color: o.cor ?? PRETO,
    });

  // Primeira linha de cada bloco: O.S., Status, Tipo, Rateio, Duração, H.H., Valor.
  const cols = [
    { t: "O.S.", x: 0 },
    { t: "Status", x: 14 },
    { t: "Tipo", x: 40 },
    { t: "Rateio", x: 82 },
    { t: "Duração", x: 100 },
    { t: "H.H.", x: 124 },
    ...(comCustos ? [{ t: "Valor", x: 150 }] : []),
  ];
  const topo = (primeira: boolean) => {
    if (primeira) {
      texto("DASHBOARD DE O.S. ABERTAS", MARGENS.lateral, {
        tamanho: 14,
        fonte: negrito,
        cor: AZUL,
      });
      atual += 5;
      texto(`${emitidoEm(agora)} · ${oss.length} O.S.`, MARGENS.lateral, {
        cor: CINZA,
      });
      atual += 7;
    }
    for (const c of cols)
      texto(c.t.toUpperCase(), MARGENS.lateral + c.x, {
        tamanho: 6.5,
        fonte: negrito,
        cor: CINZA,
      });
    atual += 1.5;
    pagina.drawLine({
      start: { x: x(MARGENS.lateral), y: y(atual) },
      end: { x: x(MARGENS.lateral + LARGURA), y: y(atual) },
      thickness: 0.8,
      color: AZUL,
    });
  };
  topo(true);

  if (!oss.length) {
    atual += 6;
    texto("Nenhuma O.S. em aberto.", MARGENS.lateral, { cor: CINZA });
  }
  for (const o of oss) {
    const l = linhaAberta(o);
    const detalhe = quebrarLinhas(
      normal,
      7.5,
      `Técnicos: ${String(l[4] || "—")} · Períodos: ${String(l[5] || "—")}`,
      LARGURA * MM,
    ).slice(0, 2);
    const descricao = quebrarLinhas(
      normal,
      7.5,
      String(l[9] || "Sem descrição informada."),
      LARGURA * MM,
    ).slice(0, 2);
    const altura = 5 + (detalhe.length + descricao.length) * 3.6 + 2;
    if (atual + altura > LIMITE) {
      pagina = novaPagina(papel);
      atual = MARGENS.topo;
      topo(false);
    }
    atual += 5;
    const valores = [
      String(l[0]),
      String(l[1]),
      String(l[2]),
      String(l[3]),
      String(l[6]),
      String(l[7]),
      ...(comCustos ? [formatarMoeda(o.valor)] : []),
    ];
    valores.forEach((v, i) => {
      const c = cols[i];
      if (c)
        texto(v, MARGENS.lateral + c.x, {
          tamanho: 8.5,
          fonte: i === 0 ? negrito : normal,
        });
    });
    [...detalhe, ...descricao].forEach((linha, i) => {
      atual += 3.6;
      texto(linha, MARGENS.lateral, {
        tamanho: 7.5,
        cor: i < detalhe.length ? CINZA : PRETO,
      });
    });
    atual += 2;
    pagina.drawLine({
      start: { x: x(MARGENS.lateral), y: y(atual) },
      end: { x: x(MARGENS.lateral + LARGURA), y: y(atual) },
      thickness: 0.4,
      color: LINHA,
    });
  }
  numerarPaginas(papel);
  return { bytes: await doc.save(), nome: arquivoAbertas(agora, "pdf") };
}
