import "server-only";
import { PDFDocument, type PDFPage, rgb } from "pdf-lib";
import { textoDaResposta } from "@/lib/sustentabilidade/entrevistas-respostas";
import type {
  DefinicaoFormulario,
  Respostas,
} from "@/lib/sustentabilidade/formulario/tipos";
import { secoesComPerguntas } from "@/lib/sustentabilidade/formulario/visibilidade";
import {
  A4,
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
  y,
} from "@/server/os/pdf/papel-timbrado";

// Entrevista assinada em PDF (spec 4.4, Tela 2): papel timbrado da ARP
// (4.16 A do Chamados), identificação, as respostas das perguntas que se
// aplicaram (uma seção depois da outra, no texto da versão respondida), as
// duas assinaturas (respondente e entrevistador) e a data e a hora.

const VERDE = cor("#2F7D3D");
const ESQ = MARGENS.lateral * MM;
const LARGURA = A4.largura - 2 * ESQ;
const TOPO = y(MARGENS.topo);
const FIM = MARGENS.base * MM;
const ASSINATURA_L = 80 * MM;
const ASSINATURA_A = 26 * MM;

export interface AssinaturaDoPdf {
  /** Quem assina e o papel ("Respondente", "Entrevistador(a) – equipe ARP"). */
  nome: string;
  papel: string;
  png: Uint8Array | null;
}

export interface DadosDoPdfDaEntrevista {
  empresa: string;
  lucs: string[];
  contrato: string | null;
  /** "1ª vez" ou "Atualização". */
  tipo: string;
  /** "dd/mm/aaaa". */
  data: string;
  versao: number;
  definicao: DefinicaoFormulario;
  respostas: Respostas;
  assinaturas: AssinaturaDoPdf[];
  /** "16/11/2026 às 10:42" (Brasília). */
  salvaEm: string;
  validaAte: string | null;
}

class Escrita {
  pagina: PDFPage;
  yAtual = TOPO;
  constructor(private readonly papel: Papel) {
    this.pagina = novaPagina(papel);
  }

  reservar(altura: number) {
    if (this.yAtual - altura >= FIM) return;
    this.pagina = novaPagina(this.papel);
    this.yAtual = TOPO;
  }

  texto(
    t: string,
    tamanho: number,
    o: {
      negrito?: boolean;
      corTexto?: ReturnType<typeof rgb>;
      recuo?: number;
    } = {},
  ) {
    const fonte = o.negrito
      ? this.papel.fontes.negrito
      : this.papel.fontes.normal;
    const recuo = o.recuo ?? 0;
    const ls = quebrarLinhas(fonte, tamanho, t, LARGURA - recuo);
    const entre = tamanho * 1.35;
    for (const l of ls) {
      this.reservar(entre);
      this.yAtual -= entre;
      this.pagina.drawText(l, {
        x: ESQ + recuo,
        y: this.yAtual + tamanho * 0.25,
        size: tamanho,
        font: fonte,
        color: o.corTexto ?? rgb(0.1, 0.1, 0.1),
      });
    }
  }

  espaco(pt: number) {
    this.yAtual -= pt;
  }
}

export async function gerarPdfDaEntrevista(
  d: DadosDoPdfDaEntrevista,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Entrevista de resíduos – ${d.empresa}`);
  doc.setAuthor("ARP – Sustentabilidade");
  doc.setLanguage("pt-BR");
  const papel = await prepararPapel(doc);
  const e = new Escrita(papel);

  e.texto("Entrevista de diagnóstico de resíduos", 14, {
    negrito: true,
    corTexto: VERDE,
  });
  e.texto(
    [
      d.empresa,
      d.lucs.length ? `LUC ${d.lucs.join("/")}` : "",
      d.contrato ? `Contrato ${d.contrato}` : "",
    ]
      .filter(Boolean)
      .join(" · "),
    10,
  );
  e.texto(
    `${d.tipo} · Entrevista de ${d.data} · Questionário versão ${d.versao}${d.validaAte ? ` · Válida até ${d.validaAte}` : ""}`,
    9,
    { corTexto: CINZA },
  );
  e.espaco(8);

  for (const { secao, perguntas } of secoesComPerguntas(
    d.definicao,
    d.respostas,
  )) {
    e.reservar(40);
    e.espaco(4);
    e.texto(secao.nome, 11, { negrito: true, corTexto: VERDE });
    for (const p of perguntas) {
      const resposta = textoDaResposta(p, d.respostas[p.id]) || "—";
      e.reservar(28);
      e.texto(`${p.numero}. ${p.texto}`, 9, { negrito: true });
      e.texto(resposta, 9.5, { recuo: 8 });
      e.espaco(3);
    }
  }

  // Assinaturas lado a lado; descem juntas para a próxima folha se não couber.
  e.espaco(10);
  e.reservar(ASSINATURA_A + 50);
  const base = e.yAtual - ASSINATURA_A - 6;
  const coluna = LARGURA / 2;
  for (const [i, a] of d.assinaturas.slice(0, 2).entries()) {
    const meio = ESQ + coluna * i + coluna / 2;
    if (a.png) {
      try {
        const img = await doc.embedPng(a.png);
        const escala = Math.min(
          ASSINATURA_L / img.width,
          ASSINATURA_A / img.height,
        );
        const w = img.width * escala;
        const h = img.height * escala;
        e.pagina.drawImage(img, {
          x: meio - w / 2,
          y: base + 2,
          width: w,
          height: h,
        });
      } catch (erro) {
        console.error("assinatura do PDF da entrevista", erro);
      }
    }
    e.pagina.drawLine({
      start: { x: meio - ASSINATURA_L / 2, y: base },
      end: { x: meio + ASSINATURA_L / 2, y: base },
      thickness: 0.6,
      color: PRETO,
    });
    const f = papel.fontes;
    let yy = base - 12;
    for (const [t, fonte, tam] of [
      [a.nome, f.negrito, 9.5],
      [a.papel, f.normal, 8.5],
    ] as const) {
      for (const parte of quebrarLinhas(fonte, tam, t, coluna - 12)) {
        e.pagina.drawText(parte, {
          x: meio - fonte.widthOfTextAtSize(parte, tam) / 2,
          y: yy,
          size: tam,
          font: fonte,
          color: PRETO,
        });
        yy -= tam * 1.3;
      }
    }
  }
  e.yAtual = base - 44;
  e.texto(`Assinada e salva em ${d.salvaEm} (horário de Brasília).`, 8.5, {
    corTexto: CINZA,
  });

  numerarPaginas(papel);
  return doc.save();
}
