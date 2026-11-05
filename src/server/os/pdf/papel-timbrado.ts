import "server-only";
import {
  type PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  rgb,
  StandardFonts,
} from "pdf-lib";
import { baixarArquivo } from "../base";
import { LOGO_PNG_BASE64 } from "./logo";

// Papel timbrado da ARP (seção 4.16 A): fundo de página inteira em todas as
// páginas de todo PDF do módulo (OS, laudo, relatórios). Se a imagem
// oficial (1654 × 2339, A4) foi enviada em Parâmetros, ela vira o fundo;
// sem ela, desenhamos uma versão fiel (a logo oficial, trevo verde claro e
// rodapé "Arp. Onde tudo acontece").
//
// Medidas em milímetros, como na especificação; o pdf-lib usa pontos com a
// origem embaixo à esquerda, então `y(mm)` converte a distância do topo.

export const MM = 72 / 25.4;
export const A4 = { largura: 210 * MM, altura: 297 * MM } as const;

/**
 * Área útil: o conteúdo começa a 38 mm do topo e termina a 48 mm do fim
 * (249 mm), acima do rodapé, que começa na linha a 252 mm.
 */
export const MARGENS = { topo: 38, base: 48, lateral: 14 } as const;

/** Onde fica a imagem enviada em Parâmetros (bucket privado "os"). */
export const CAMINHOS_PAPEL_TIMBRADO = [
  "config/papel-timbrado.png",
  "config/papel-timbrado.jpg",
] as const;

export const CINZA = rgb(0.45, 0.45, 0.45);
export const CINZA_ESCURO = rgb(0.25, 0.25, 0.25);
export const PRETO = rgb(0, 0, 0);
export const BRANCO = rgb(1, 1, 1);

/** Hex (#1E7DD2) → cor do pdf-lib. */
export function cor(hex: string) {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Distância do topo (mm) → coordenada y do pdf-lib (pt). */
export function y(mm: number): number {
  return A4.altura - mm * MM;
}

/** Distância da esquerda (mm) → coordenada x (pt). */
export function x(mm: number): number {
  return mm * MM;
}

export interface Fontes {
  normal: PDFFont;
  negrito: PDFFont;
  italico: PDFFont;
  negritoItalico: PDFFont;
}

export interface Papel {
  doc: PDFDocument;
  fontes: Fontes;
  /** Imagem oficial, se foi enviada. */
  fundo: PDFImage | null;
  /** Logo da ARP (desenhada quando não há a imagem oficial). */
  logo: PDFImage;
}

/** Fontes (Helvetica, como o sistema atual) e o fundo, uma vez por PDF. */
export async function prepararPapel(doc: PDFDocument): Promise<Papel> {
  const [normal, negrito, italico, negritoItalico, logo] = await Promise.all([
    doc.embedFont(StandardFonts.Helvetica),
    doc.embedFont(StandardFonts.HelveticaBold),
    doc.embedFont(StandardFonts.HelveticaOblique),
    doc.embedFont(StandardFonts.HelveticaBoldOblique),
    doc.embedPng(LOGO_PNG_BASE64),
  ]);
  let fundo: PDFImage | null = null;
  for (const caminho of CAMINHOS_PAPEL_TIMBRADO) {
    const bytes = await baixarArquivo(caminho);
    if (!bytes) continue;
    try {
      fundo = caminho.endsWith(".png")
        ? await doc.embedPng(bytes)
        : await doc.embedJpg(bytes);
      break;
    } catch (erro) {
      console.error("papel timbrado inválido", caminho, erro);
    }
  }
  return {
    doc,
    fontes: { normal, negrito, italico, negritoItalico },
    fundo,
    logo,
  };
}

/**
 * Página A4 retrato já com o papel timbrado no fundo. Sem rodapé (folhas
 * do meio do laudo), o endereço não aparece e o conteúdo desce até o fim.
 */
export function novaPagina(papel: Papel, { rodape = true } = {}): PDFPage {
  const pagina = papel.doc.addPage([A4.largura, A4.altura]);
  if (papel.fundo) {
    pagina.drawImage(papel.fundo, {
      x: 0,
      y: 0,
      width: A4.largura,
      height: A4.altura,
    });
    // atalho: cobre o rodapé da imagem enviada com branco (o trevo
    // termina acima dele, em 233 mm).
    if (!rodape)
      pagina.drawRectangle({
        x: 0,
        y: y(276),
        width: x(110),
        height: 29 * MM,
        color: BRANCO,
      });
  } else {
    desenharTimbrado(pagina, papel, rodape);
  }
  return pagina;
}

const VERDE_CLARO = rgb(0.886, 0.988, 0.906);

// Folha com um canto reto (o do centro do trevo) e os outros arredondados.
function folha(
  pagina: PDFPage,
  mm: { esq: number; topo: number; larg: number; alt: number },
  raios: { se: number; sd: number; id: number; ie: number },
) {
  const r = (v: number) => v * MM;
  const L = r(mm.larg);
  const H = r(mm.alt);
  const { se, sd, id, ie } = {
    se: r(raios.se),
    sd: r(raios.sd),
    id: r(raios.id),
    ie: r(raios.ie),
  };
  // Caminho SVG com y para baixo a partir do canto superior esquerdo.
  const caminho = [
    `M ${se} 0`,
    `L ${L - sd} 0`,
    sd ? `A ${sd} ${sd} 0 0 1 ${L} ${sd}` : "",
    `L ${L} ${H - id}`,
    id ? `A ${id} ${id} 0 0 1 ${L - id} ${H}` : "",
    `L ${ie} ${H}`,
    ie ? `A ${ie} ${ie} 0 0 1 0 ${H - ie}` : "",
    `L 0 ${se}`,
    se ? `A ${se} ${se} 0 0 1 ${se} 0` : "",
    "Z",
  ]
    .filter(Boolean)
    .join(" ");
  pagina.drawSvgPath(caminho, {
    x: x(mm.esq),
    y: y(mm.topo),
    color: VERDE_CLARO,
    borderWidth: 0,
  });
}

/** Papel timbrado desenhado (quando a imagem oficial não foi enviada). */
function desenharTimbrado(
  pagina: PDFPage,
  { fontes: f, logo }: Papel,
  rodape: boolean,
) {
  // Trevo verde claro, saindo pela borda direita.
  folha(
    pagina,
    { esq: 83.5, topo: 112, larg: 44.5, alt: 41.5 },
    { se: 20.5, sd: 0, id: 0, ie: 20.5 },
  );
  folha(
    pagina,
    { esq: 137, topo: 84, larg: 73, alt: 69.5 },
    { se: 34, sd: 0, id: 0, ie: 0 },
  );
  folha(
    pagina,
    { esq: 83.5, topo: 163, larg: 44.5, alt: 41 },
    { se: 20.5, sd: 0, id: 0, ie: 20.5 },
  );
  folha(
    pagina,
    { esq: 137, topo: 163, larg: 73, alt: 69.5 },
    { se: 0, sd: 0, id: 0, ie: 34 },
  );

  // Logo oficial (ARP com o trevo verde), acima do conteúdo (38 mm).
  const largura = 32 * MM;
  const altura = (largura * logo.height) / logo.width;
  pagina.drawImage(logo, {
    x: x(27.5),
    y: y(14) - altura,
    width: largura,
    height: altura,
  });

  // Rodapé.
  if (!rodape) return;
  pagina.drawLine({
    start: { x: x(29.5), y: y(252) },
    end: { x: x(89), y: y(252) },
    thickness: 0.6,
    color: PRETO,
  });
  pagina.drawText("Arp. Onde tudo acontece", {
    x: x(29.5),
    y: y(256.5),
    size: 9,
    font: f.negrito,
    color: PRETO,
  });
  const endereco = [
    "Av. Conselheiro Julius Arp, 80 - Cep: 28623000",
    "Centro Nova Friburgo RJ",
    "22 2525-8300",
  ];
  endereco.forEach((linha, i) => {
    pagina.drawText(linha, {
      x: x(29.5),
      y: y(262 + i * 3.4),
      size: 6.5,
      font: f.normal,
      color: PRETO,
    });
  });
}

/** "1 de 5" no canto inferior direito, a 14 mm do fim, tamanho 8, cinza. */
export function numerarPaginas(papel: Papel): void {
  const paginas = papel.doc.getPages();
  paginas.forEach((p, i) => {
    const t = `${i + 1} de ${paginas.length}`;
    const largura = papel.fontes.normal.widthOfTextAtSize(t, 8);
    p.drawText(t, {
      x: A4.largura - x(MARGENS.lateral) - largura,
      y: y(297 - 14),
      size: 8,
      font: papel.fontes.normal,
      color: CINZA,
    });
  });
}

// As fontes padrão do PDF (WinAnsi) não têm todos os caracteres: troca os
// que faltam por equivalentes e descarta o resto (emoji, por exemplo).
const TROCAS: Record<string, string> = {
  "‐": "-",
  "‑": "-",
  "‒": "-",
  "−": "-",
  " ": " ",
  " ": " ",
  " ": " ",
  "→": "->",
  "≥": ">=",
  "≤": "<=",
  "✓": "v",
  "×": "x",
  // Quebra de linha e tabulação viram espaço (a fonte não tem esses
  // caracteres; sumir com eles colaria as palavras). Quem quer manter as
  // linhas (quebrarLinhas) separa os parágrafos antes.
  "\t": " ",
  "\n": " ",
  "\r": " ",
};

/** Texto que a fonte consegue desenhar. */
export function seguro(fonte: PDFFont, texto: string): string {
  let saida = "";
  for (const ch of texto.normalize("NFC")) {
    const c = TROCAS[ch] ?? ch;
    try {
      fonte.encodeText(c);
      saida += c;
    } catch {
      // caractere fora da fonte: some
    }
  }
  return saida;
}

/** Quebra o texto em linhas que cabem na largura (pt), respeitando "\n". */
export function quebrarLinhas(
  fonte: PDFFont,
  tamanho: number,
  texto: string,
  largura: number,
): string[] {
  const linhas: string[] = [];
  for (const paragrafo of texto.split(/\r?\n/).map((p) => seguro(fonte, p))) {
    let atual = "";
    for (const palavra of paragrafo.split(/\s+/).filter(Boolean)) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (fonte.widthOfTextAtSize(tentativa, tamanho) <= largura) {
        atual = tentativa;
        continue;
      }
      if (atual) linhas.push(atual);
      // Palavra maior que a linha: corta em pedaços.
      let resto = palavra;
      while (fonte.widthOfTextAtSize(resto, tamanho) > largura) {
        let n = resto.length;
        while (
          n > 1 &&
          fonte.widthOfTextAtSize(resto.slice(0, n), tamanho) > largura
        )
          n--;
        linhas.push(resto.slice(0, n));
        resto = resto.slice(n);
      }
      atual = resto;
    }
    linhas.push(atual);
  }
  return linhas;
}

/**
 * Texto justificado (termo do laudo): espalha as palavras para encostar
 * nas duas margens, menos na última linha de cada parágrafo.
 */
export function desenharJustificado(
  pagina: PDFPage,
  fonte: PDFFont,
  tamanho: number,
  texto: string,
  opcoes: { x: number; y: number; largura: number; entrelinha: number },
): number {
  let yAtual = opcoes.y;
  for (const paragrafo of texto.split(/\r?\n/)) {
    const linhas = quebrarLinhas(fonte, tamanho, paragrafo, opcoes.largura);
    linhas.forEach((linha, i) => {
      const palavras = linha.split(" ");
      const ultima = i === linhas.length - 1;
      if (ultima || palavras.length < 2) {
        pagina.drawText(linha, {
          x: opcoes.x,
          y: yAtual,
          size: tamanho,
          font: fonte,
        });
      } else {
        const semEspacos = palavras.reduce(
          (s, p) => s + fonte.widthOfTextAtSize(p, tamanho),
          0,
        );
        const espaco = (opcoes.largura - semEspacos) / (palavras.length - 1);
        let xAtual = opcoes.x;
        for (const p of palavras) {
          pagina.drawText(p, {
            x: xAtual,
            y: yAtual,
            size: tamanho,
            font: fonte,
          });
          xAtual += fonte.widthOfTextAtSize(p, tamanho) + espaco;
        }
      }
      yAtual -= opcoes.entrelinha;
    });
  }
  return yAtual;
}
