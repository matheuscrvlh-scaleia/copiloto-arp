import "server-only";
import { PDFDocument, type PDFPage, rgb } from "pdf-lib";
import type { BlocoDaFicha } from "@/lib/comercial/ficha";
import {
  A4,
  CINZA,
  cor,
  MARGENS,
  MM,
  novaPagina,
  numerarPaginas,
  type Papel,
  prepararPapel,
  quebrarLinhas,
  y,
} from "@/server/os/pdf/papel-timbrado";

// "Ficha cadastral em PDF" (4.12): todos os dados em blocos, para análise e
// arquivo, no papel timbrado da ARP. Rótulo à esquerda, resposta à direita;
// bloco que não cabe no fim da folha continua na próxima.

const VERDE = cor("#2F7D3D");
const ESQ = MARGENS.lateral * MM;
const LARGURA = A4.largura - 2 * ESQ;
const COL_ROTULO = 58 * MM;
const TOPO = y(MARGENS.topo);
const FIM = MARGENS.base * MM;

export interface DadosDoPdf {
  titulo: string;
  /** "Locatário PJ · Recebida em 04/11/2026 · Origem: Sistema". */
  subtitulo: string;
  blocos: BlocoDaFicha[];
  /** Linhas do rodapé de informações (consentimento, documentos). */
  notas: string[];
  geradoEm: string;
}

class Escrita {
  private pagina: PDFPage;
  private yAtual = TOPO;
  constructor(private readonly papel: Papel) {
    this.pagina = novaPagina(papel);
  }

  private reservar(altura: number) {
    if (this.yAtual - altura >= FIM) return;
    this.pagina = novaPagina(this.papel);
    this.yAtual = TOPO;
  }

  linhas(
    texto: string,
    tamanho: number,
    opcoes: {
      negrito?: boolean;
      corTexto?: ReturnType<typeof rgb>;
      x?: number;
      largura?: number;
    } = {},
  ): number {
    const fonte = opcoes.negrito
      ? this.papel.fontes.negrito
      : this.papel.fontes.normal;
    const ls = quebrarLinhas(fonte, tamanho, texto, opcoes.largura ?? LARGURA);
    const entre = tamanho * 1.35;
    this.reservar(entre * ls.length);
    for (const l of ls) {
      this.yAtual -= entre;
      this.pagina.drawText(l, {
        x: opcoes.x ?? ESQ,
        y: this.yAtual + tamanho * 0.25,
        size: tamanho,
        font: fonte,
        color: opcoes.corTexto ?? rgb(0.1, 0.1, 0.1),
      });
    }
    return ls.length;
  }

  espaco(pt: number) {
    this.yAtual -= pt;
  }

  secao(titulo: string) {
    this.reservar(48);
    this.espaco(8);
    this.linhas(titulo.toUpperCase(), 9.5, { negrito: true, corTexto: VERDE });
    this.espaco(3);
    this.pagina.drawLine({
      start: { x: ESQ, y: this.yAtual },
      end: { x: ESQ + LARGURA, y: this.yAtual },
      thickness: 0.8,
      color: VERDE,
    });
    this.espaco(4);
  }

  /** Rótulo e valor lado a lado (o valor quebra na própria coluna). */
  campo(rotulo: string, valor: string) {
    const f = this.papel.fontes;
    const tamanho = 8.5;
    const entre = tamanho * 1.35;
    const r = quebrarLinhas(f.negrito, tamanho, rotulo, COL_ROTULO - 4 * MM);
    const v = quebrarLinhas(f.normal, tamanho, valor, LARGURA - COL_ROTULO);
    const n = Math.max(r.length, v.length);
    this.reservar(entre * n + 3);
    const topo = this.yAtual;
    r.forEach((l, i) => {
      this.pagina.drawText(l, {
        x: ESQ,
        y: topo - entre * (i + 1) + tamanho * 0.25,
        size: tamanho,
        font: f.negrito,
        color: CINZA,
      });
    });
    v.forEach((l, i) => {
      this.pagina.drawText(l, {
        x: ESQ + COL_ROTULO,
        y: topo - entre * (i + 1) + tamanho * 0.25,
        size: tamanho,
        font: f.normal,
        color: rgb(0.1, 0.1, 0.1),
      });
    });
    this.yAtual = topo - entre * n - 3;
  }
}

/** PDF da ficha, pronto para baixar. */
export async function gerarPdfDaFicha(d: DadosDoPdf): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Ficha cadastral · ${d.titulo}`);
  doc.setAuthor("ARP");
  const papel = await prepararPapel(doc);
  const e = new Escrita(papel);
  e.linhas("Ficha cadastral", 16, { negrito: true });
  e.linhas(d.titulo, 11, { negrito: true });
  e.linhas(d.subtitulo, 8.5, { corTexto: CINZA });
  for (const b of d.blocos) {
    e.secao(b.titulo);
    for (const i of b.itens)
      e.campo(i.pergunta ? `${i.pergunta}. ${i.rotulo}` : i.rotulo, i.valor);
  }
  if (d.notas.length) {
    e.secao("Consentimento e documentos");
    for (const n of d.notas) e.linhas(n, 8.5);
  }
  e.espaco(10);
  e.linhas(
    `Gerado em ${d.geradoEm}. Documento com dados pessoais (LGPD): uso restrito à análise locatícia.`,
    7.5,
    { corTexto: CINZA },
  );
  numerarPaginas(papel);
  return doc.save();
}
