import "server-only";
import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  rgb,
  StandardFonts,
} from "pdf-lib";
import { ABAS_MARCA, type AbaDeBlocos, estaVazio } from "@/lib/marketing/marca";
import type { BlocoMarca } from "@/server/marketing/marca";
import { LOGO_PNG_BASE64 } from "@/server/os/pdf/logo";
import {
  A4,
  cor,
  MM,
  quebrarLinhas,
  seguro,
} from "@/server/os/pdf/papel-timbrado";

// "One page" da plataforma da marca para fornecedores (spec 4.4, Exportar):
// abas Plataforma, Tom de voz e Público em duas colunas numa folha A4. Se
// a base crescer além de uma folha, continua na próxima (nunca corta).
// Blocos vazios não saem: o PDF é para quem está fora.

const ABAS: AbaDeBlocos[] = ["plataforma", "tom_de_voz", "publico"];
const VERDE = cor("#2F7D3D");
const CINZA = rgb(0.4, 0.4, 0.4);
const VERMELHO = cor("#B91C1C");

const MARGEM = 14 * MM;
const ENTRE_COLUNAS = 8 * MM;
const LARGURA_COLUNA = (A4.largura - 2 * MARGEM - ENTRE_COLUNAS) / 2;
const TOPO_CONTEUDO = A4.altura - 42 * MM;
const FIM = 16 * MM;

interface Fontes {
  normal: PDFFont;
  negrito: PDFFont;
  italico: PDFFont;
}

/** Escreve em colunas: esquerda, direita, próxima folha. */
class Colunas {
  private coluna = 0;
  private y = TOPO_CONTEUDO;
  constructor(
    private pagina: PDFPage,
    private readonly novaPagina: () => PDFPage,
  ) {}

  private get x() {
    return MARGEM + this.coluna * (LARGURA_COLUNA + ENTRE_COLUNAS);
  }

  /** Garante espaço; se não couber, pula de coluna (ou de folha). */
  reservar(altura: number) {
    if (this.y - altura >= FIM) return;
    if (this.coluna === 0) {
      this.coluna = 1;
    } else {
      this.coluna = 0;
      this.pagina = this.novaPagina();
    }
    this.y = TOPO_CONTEUDO;
  }

  espaco(pt: number) {
    this.y -= pt;
  }

  /** Ainda na coluna da esquerda: passa para a da direita. */
  irParaDireita() {
    if (this.coluna !== 0) return;
    this.coluna = 1;
    this.y = TOPO_CONTEUDO;
  }

  /** Parágrafo quebrado na largura da coluna. */
  texto(
    texto: string,
    fonte: PDFFont,
    tamanho: number,
    opcoes: { corTexto?: ReturnType<typeof rgb>; recuo?: number } = {},
  ) {
    const recuo = opcoes.recuo ?? 0;
    const entrelinha = tamanho * 1.3;
    for (const linha of quebrarLinhas(
      fonte,
      tamanho,
      texto,
      LARGURA_COLUNA - recuo,
    )) {
      this.reservar(entrelinha);
      this.y -= entrelinha;
      this.pagina.drawText(linha, {
        x: this.x + recuo,
        y: this.y + tamanho * 0.25,
        size: tamanho,
        font: fonte,
        color: opcoes.corTexto ?? rgb(0.1, 0.1, 0.1),
      });
    }
  }

  /** Título de seção com um fio verde embaixo. */
  secao(titulo: string, f: Fontes) {
    this.reservar(40);
    if (this.y < TOPO_CONTEUDO) this.y -= 6;
    this.texto(titulo.toUpperCase(), f.negrito, 9.5, { corTexto: VERDE });
    this.y -= 3;
    this.pagina.drawLine({
      start: { x: this.x, y: this.y },
      end: { x: this.x + LARGURA_COLUNA, y: this.y },
      thickness: 0.8,
      color: VERDE,
    });
    this.y -= 6;
  }
}

function desenharBloco(c: Colunas, b: BlocoMarca, f: Fontes) {
  c.reservar(28);
  const proibidas = b.chave === "palavras_proibidas";
  c.texto(b.titulo, f.negrito, 8.5);
  c.espaco(1.5);
  const conteudo = b.conteudo;
  if (conteudo.tipo === "texto") {
    const destaque = b.chave === "proposito" || b.chave === "tagline";
    c.texto(conteudo.texto, destaque ? f.italico : f.normal, destaque ? 10 : 8);
  } else if (conteudo.tipo === "lista") {
    const comExplicacao = conteudo.itens.some((i) => i.texto);
    if (!comExplicacao) {
      // Só nomes: numa linha, separados por ponto.
      c.texto(conteudo.itens.map((i) => i.titulo).join("  ·  "), f.normal, 8, {
        corTexto: proibidas ? VERMELHO : undefined,
      });
    } else {
      for (const i of conteudo.itens) {
        c.texto(i.texto ? `${i.titulo}: ${i.texto}` : i.titulo, f.normal, 8, {
          recuo: 6,
        });
        c.espaco(1);
      }
    }
  } else {
    c.texto(
      conteudo.itens.map((i) => `${i.nome} ${i.hex}`).join("  ·  "),
      f.normal,
      8,
    );
  }
  c.espaco(7);
}

/** PDF da plataforma da marca, pronto para baixar. */
export async function gerarPdfMarca(
  blocos: BlocoMarca[],
  versao: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Plataforma da marca ARP");
  doc.setAuthor("ARP");
  const [normal, negrito, italico, logo] = await Promise.all([
    doc.embedFont(StandardFonts.Helvetica),
    doc.embedFont(StandardFonts.HelveticaBold),
    doc.embedFont(StandardFonts.HelveticaOblique),
    doc.embedPng(LOGO_PNG_BASE64),
  ]);
  const f: Fontes = { normal, negrito, italico };

  const nova = () => {
    const p = doc.addPage([A4.largura, A4.altura]);
    const largura = 26 * MM;
    const altura = (largura * logo.height) / logo.width;
    p.drawImage(logo, {
      x: MARGEM,
      y: A4.altura - 12 * MM - altura,
      width: largura,
      height: altura,
    });
    const titulo = "Plataforma da marca";
    p.drawText(titulo, {
      x: A4.largura - MARGEM - negrito.widthOfTextAtSize(titulo, 16),
      y: A4.altura - 20 * MM,
      size: 16,
      font: negrito,
    });
    const sub = seguro(normal, `${versao} · uso de fornecedores e parceiros`);
    p.drawText(sub, {
      x: A4.largura - MARGEM - normal.widthOfTextAtSize(sub, 8),
      y: A4.altura - 26 * MM,
      size: 8,
      font: normal,
      color: CINZA,
    });
    p.drawLine({
      start: { x: MARGEM, y: A4.altura - 34 * MM },
      end: { x: A4.largura - MARGEM, y: A4.altura - 34 * MM },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    const rodape = "Arp. Onde tudo acontece";
    p.drawText(rodape, {
      x: MARGEM,
      y: 9 * MM,
      size: 7,
      font: negrito,
      color: CINZA,
    });
    return p;
  };

  const c = new Colunas(nova(), nova);
  for (const aba of ABAS) {
    const daAba = blocos.filter((b) => b.aba === aba && !estaVazio(b.conteudo));
    if (!daAba.length) continue;
    // Plataforma à esquerda; tom de voz e público à direita.
    if (aba === "tom_de_voz") c.irParaDireita();
    c.secao(ABAS_MARCA[aba], f);
    for (const b of daAba) desenharBloco(c, b, f);
  }

  const paginas = doc.getPages();
  if (paginas.length > 1)
    paginas.forEach((p, i) => {
      const t = `${i + 1} de ${paginas.length}`;
      p.drawText(t, {
        x: A4.largura - MARGEM - normal.widthOfTextAtSize(t, 7),
        y: 9 * MM,
        size: 7,
        font: normal,
        color: CINZA,
      });
    });
  return doc.save();
}
