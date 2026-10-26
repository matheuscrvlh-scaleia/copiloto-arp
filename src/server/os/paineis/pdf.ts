import "server-only";
import { PDFDocument, type PDFFont, type PDFPage, rgb } from "pdf-lib";
import type {
  Bloco,
  Conteudo,
  PainelMontado,
} from "@/components/os/paineis/tipos";
import { rotuloStatus } from "@/lib/indicadores";
import {
  A4,
  CINZA,
  CINZA_ESCURO,
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

// PDF do painel: título, filtros, os 4 cartões e a tabela de cada bloco
// (os mesmos números da tela, no papel timbrado). As listas de chamados
// saem em Excel, bloco a bloco.

interface TabelaPdf {
  titulo?: string;
  colunas: string[];
  linhas: string[][];
}

const comStatus = (
  texto: string,
  s?: Parameters<typeof rotuloStatus>[0],
  d?: Parameters<typeof rotuloStatus>[1],
) => (s && s !== "sem_dado" ? `${texto} (${rotuloStatus(s, d)})` : texto);

/** Cada parte do bloco vira uma tabela simples. */
export function tabelasDoBloco(b: Bloco): TabelaPdf[] {
  return b.partes.flatMap((p: Conteudo): TabelaPdf[] => {
    switch (p.tipo) {
      case "barras":
      case "colunas":
      case "faixas":
      case "rosca":
        return p.itens.length
          ? [
              {
                colunas: ["Item", "Valor", "Detalhe"],
                linhas: p.itens.map((i) => [
                  i.titulo ?? i.rotulo,
                  i.texto,
                  i.detalhe ?? "",
                ]),
              },
            ]
          : [];
      case "espelhadas":
        return [
          {
            colunas: ["Período", p.rotulos.acima, p.rotulos.abaixo],
            linhas: p.itens.map((i) => [
              i.titulo,
              String(i.acima),
              String(i.abaixo),
            ]),
          },
        ];
      case "numeros":
        return [
          {
            colunas: ["Indicador", "Valor", "Detalhe"],
            linhas: p.numeros.map((n) => [
              n.rotulo,
              comStatus(n.valor, n.status, n.direcao),
              n.detalhe ?? "",
            ]),
          },
        ];
      case "tabela":
        return [
          {
            colunas: p.colunas.map((c) => c.titulo),
            linhas: p.linhas.map((l) =>
              l.celulas.map((c) => comStatus(c.texto, c.status, c.direcao)),
            ),
          },
        ];
      case "matriz":
        return [
          {
            colunas: ["Pediu → Recebeu", ...p.destinos.map((d) => d.rotulo)],
            linhas: p.origens.map((o) => [
              o.rotulo,
              ...p.destinos.map((d) =>
                String(p.celulas[`${o.chave}>${d.chave}`]?.n ?? 0),
              ),
            ]),
          },
        ];
      default:
        return [];
    }
  });
}

const LARGURA = A4.largura - 2 * x(MARGENS.lateral);
const TOPO = y(MARGENS.topo);
const FUNDO = y(297 - MARGENS.base);

class Escrita {
  pagina: PDFPage;
  cursor = TOPO;

  constructor(private readonly papel: Papel) {
    this.pagina = novaPagina(papel);
  }

  get f() {
    return this.papel.fontes;
  }

  /** Garante espaço; senão, página nova. */
  espaco(altura: number) {
    if (this.cursor - altura < FUNDO) {
      this.pagina = novaPagina(this.papel);
      this.cursor = TOPO;
    }
  }

  texto(
    t: string,
    o: {
      tamanho?: number;
      fonte?: PDFFont;
      cor?: ReturnType<typeof rgb>;
      depois?: number;
    } = {},
  ) {
    const tamanho = o.tamanho ?? 9;
    const fonte = o.fonte ?? this.f.normal;
    for (const linha of quebrarLinhas(fonte, tamanho, t, LARGURA)) {
      this.espaco(tamanho * 1.4);
      this.pagina.drawText(linha, {
        x: x(MARGENS.lateral),
        y: this.cursor - tamanho,
        size: tamanho,
        font: fonte,
        color: o.cor ?? PRETO,
      });
      this.cursor -= tamanho * 1.4;
    }
    this.cursor -= o.depois ?? 0;
  }

  /** Corta o texto para caber na largura, com reticências. */
  caber(fonte: PDFFont, tamanho: number, t: string, largura: number) {
    let s = seguro(fonte, t);
    if (fonte.widthOfTextAtSize(s, tamanho) <= largura) return s;
    while (s.length > 1 && fonte.widthOfTextAtSize(`${s}…`, tamanho) > largura)
      s = s.slice(0, -1);
    return `${s}…`;
  }

  tabela(t: TabelaPdf) {
    const tamanho = 7.5;
    const altura = 13;
    const n = t.colunas.length;
    // A primeira coluna (o nome) fica com o dobro das outras.
    const unidade = LARGURA / (n + 1);
    const larguras = t.colunas.map((_, k) => (k === 0 ? unidade * 2 : unidade));
    const linha = (celulas: string[], negrito: boolean, fundo: boolean) => {
      this.espaco(altura);
      if (fundo)
        this.pagina.drawRectangle({
          x: x(MARGENS.lateral),
          y: this.cursor - altura,
          width: LARGURA,
          height: altura,
          color: rgb(0.94, 0.94, 0.94),
        });
      let cx = x(MARGENS.lateral) + 3;
      celulas.forEach((c, k) => {
        const w = (larguras[k] ?? unidade) - 6;
        const fonte = negrito ? this.f.negrito : this.f.normal;
        const texto = this.caber(fonte, tamanho, c, w);
        const direita = k > 0 && !negrito;
        this.pagina.drawText(texto, {
          x: direita ? cx + w - fonte.widthOfTextAtSize(texto, tamanho) : cx,
          y: this.cursor - altura + 4,
          size: tamanho,
          font: fonte,
          color: negrito ? CINZA_ESCURO : PRETO,
        });
        cx += larguras[k] ?? unidade;
      });
      this.cursor -= altura;
    };
    if (t.titulo) this.texto(t.titulo, { tamanho: 8, fonte: this.f.negrito });
    linha(t.colunas, true, true);
    for (const l of t.linhas) linha(l, false, false);
    if (t.linhas.length === 0)
      this.texto("Sem dados no período.", { tamanho: 7.5, cor: CINZA });
    this.cursor -= 6;
  }
}

export async function pdfDoPainel(
  painel: PainelMontado,
  filtros: string,
  geradoEm: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${painel.titulo} · ${painel.rotulo}`);
  const papel = await prepararPapel(doc);
  const e = new Escrita(papel);

  e.texto(painel.titulo, { tamanho: 16, fonte: e.f.negrito, depois: 2 });
  e.texto(filtros, { tamanho: 9, cor: CINZA_ESCURO });
  e.texto(`Gerado em ${geradoEm}`, { tamanho: 8, cor: CINZA, depois: 6 });
  if (painel.temExemplo)
    e.texto("Inclui dados de exemplo (ilustrativos).", {
      tamanho: 8,
      cor: CINZA,
      depois: 4,
    });

  e.tabela({
    colunas: ["Indicador", "Valor", "Detalhe", "Meta"],
    linhas: painel.cartoes.map((c) => [
      c.titulo,
      comStatus(c.valor, c.status, c.direcao),
      c.detalhe ?? "",
      c.meta ?? "",
    ]),
  });

  for (const b of painel.blocos) {
    e.espaco(40);
    e.texto(b.titulo, { tamanho: 11, fonte: e.f.negrito });
    if (b.descricao)
      e.texto(b.descricao, { tamanho: 8, cor: CINZA, depois: 2 });
    for (const t of tabelasDoBloco(b)) e.tabela(t);
    if (b.nota) e.texto(b.nota, { tamanho: 7.5, cor: CINZA, depois: 4 });
    e.cursor -= 4 * MM;
  }

  numerarPaginas(papel);
  return doc.save();
}
