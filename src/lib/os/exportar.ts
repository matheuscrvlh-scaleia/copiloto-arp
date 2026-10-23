import { formatarNumero } from "@/lib/formato";
import { paraBrasilia } from "./tempo";

// Exportar Excel e PDF "exatamente o que está na tela": título, a linha de
// filtros embaixo, cabeçalho em negrito, números como número e o total de
// linhas. Roda no navegador (o que a pessoa vê já passou pelo RLS) e nos
// testes; as bibliotecas pesadas só carregam na hora de gerar.

export interface ColunaExportar {
  titulo: string;
  /** Número: alinha à direita e vai como número no Excel. */
  numero?: boolean;
  /** Formato do número no Excel (ex.: "#,##0.00"). */
  formato?: string;
}

export type CelulaExportar = string | number | null;

export interface DadosExportar {
  titulo: string;
  filtros?: string;
  colunas: ColunaExportar[];
  linhas: CelulaExportar[][];
  geradoEm: Date;
}

const doisDigitos = (n: string) => n.padStart(2, "0");

/** "minha caixa" + 23/10/2026 → "minha-caixa-2026-10-23.xlsx". */
export function nomeDoArquivo(base: string, agora: Date, ext: string): string {
  const limpo =
    base
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "exportacao";
  return `${limpo}-${paraBrasilia(agora).data}.${ext}`;
}

/** "Gerado em 23/10/2026 14:05" (horário de Brasília). */
export function textoGerado(agora: Date): string {
  const { data, hora } = paraBrasilia(agora);
  const [a, m, d] = data.split("-") as [string, string, string];
  return `Gerado em ${doisDigitos(d)}/${doisDigitos(m)}/${a} ${hora}`;
}

/** "Total: 1 linha", "Total: 23 linhas". */
export function textoTotal(n: number): string {
  return `Total: ${formatarNumero(n)} ${n === 1 ? "linha" : "linhas"}`;
}

/** Casas decimais pedidas pelo formato do Excel ("#,##0.00" → 2). */
function casasDoFormato(formato?: string): number {
  const m = formato?.match(/\.(0+)/);
  return m?.[1]?.length ?? 0;
}

/** Célula como texto (PDF): número no padrão brasileiro. */
export function textoDaCelula(v: CelulaExportar, c?: ColunaExportar): string {
  if (v === null) return "";
  if (typeof v === "string") return v;
  const casas = c?.formato
    ? casasDoFormato(c.formato)
    : Number.isInteger(v)
      ? 0
      : 2;
  const texto = formatarNumero(v, casas);
  return c?.formato?.includes("R$") ? `R$ ${texto}` : texto;
}

/** Nome de aba que o Excel aceita (31 caracteres, sem []:*?/\). */
export function nomeDaAba(titulo: string): string {
  return (
    titulo
      .replace(/[[\]:*?/\\]/g, " ")
      .trim()
      .slice(0, 31) || "Planilha"
  );
}

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------

type ModuloExcel = typeof import("exceljs");

export async function gerarExcel(d: DadosExportar): Promise<Uint8Array> {
  // O pacote é CommonJS: no Node vem em `default`, no navegador direto.
  const m = (await import("exceljs")) as ModuloExcel & {
    default?: ModuloExcel;
  };
  const ExcelJS = m.default ?? m;
  const livro = new ExcelJS.Workbook();
  livro.creator = "ARP Centralizador";
  livro.created = d.geradoEm;
  const aba = livro.addWorksheet(nomeDaAba(d.titulo));
  const n = Math.max(d.colunas.length, 1);

  aba.addRow([d.titulo]).font = { bold: true, size: 14 };
  if (d.filtros)
    aba.addRow([d.filtros]).font = {
      italic: true,
      color: { argb: "FF6B6B6B" },
    };
  aba.addRow([textoGerado(d.geradoEm)]).font = {
    size: 9,
    color: { argb: "FF8A8A8A" },
  };
  aba.addRow([]);

  const cabecalho = aba.addRow(d.colunas.map((c) => c.titulo));
  cabecalho.font = { bold: true };
  cabecalho.eachCell((cel) => {
    cel.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEFEFEF" },
    };
    cel.border = { bottom: { style: "thin", color: { argb: "FF9A9A9A" } } };
  });
  const linhaCabecalho = cabecalho.number;

  for (const l of d.linhas) aba.addRow(l.map((v) => v ?? ""));
  aba.addRow([]);
  aba.addRow([textoTotal(d.linhas.length)]).font = { bold: true };

  d.colunas.forEach((c, i) => {
    const col = aba.getColumn(i + 1);
    if (c.numero) {
      col.alignment = { horizontal: "right" };
      if (c.formato) col.numFmt = c.formato;
    }
    const maior = Math.max(
      c.titulo.length,
      ...d.linhas.map((l) => textoDaCelula(l[i] ?? null, c).length),
    );
    col.width = Math.min(Math.max(maior + 2, 8), 60);
  });
  // Título e filtros não alinham pela coluna numérica.
  for (let r = 1; r < linhaCabecalho; r++)
    aba.getRow(r).alignment = { horizontal: "left" };

  aba.views = [{ state: "frozen", ySplit: linhaCabecalho }];
  if (d.linhas.length)
    aba.autoFilter = {
      from: { row: linhaCabecalho, column: 1 },
      to: { row: linhaCabecalho, column: n },
    };

  return new Uint8Array(await livro.xlsx.writeBuffer());
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

/** Muitas colunas: página deitada. */
export function emPaisagem(colunas: ColunaExportar[]): boolean {
  return colunas.length > 6;
}

/**
 * Largura de cada coluna: a natural (maior texto), cabendo no espaço. Se
 * sobrar, todas crescem na proporção; se faltar, as largas encolhem primeiro
 * e nenhuma fica abaixo do mínimo.
 */
export function largurasDasColunas(
  naturais: number[],
  disponivel: number,
  minimo = 36,
): number[] {
  if (!naturais.length) return [];
  const base = naturais.map((w) => Math.max(w, minimo));
  const soma = base.reduce((s, w) => s + w, 0);
  if (soma <= disponivel) return base.map((w) => (w / soma) * disponivel);
  // Teto comum que faz caber: as colunas mais largas param nele.
  let teto = disponivel / base.length;
  for (let i = 0; i < 30; i++) {
    const usado = base.reduce((s, w) => s + Math.min(w, teto), 0);
    const largas = base.filter((w) => w > teto).length;
    if (!largas) break;
    const proximo = teto + (disponivel - usado) / largas;
    if (Math.abs(proximo - teto) < 0.5) break;
    teto = proximo;
  }
  const finais = base.map((w) => Math.max(Math.min(w, teto), minimo));
  const total = finais.reduce((s, w) => s + w, 0);
  return finais.map((w) => (w / total) * disponivel);
}

/**
 * Quebra o texto em até `maximo` linhas que cabem na largura; o que sobra
 * vira "…" no fim da última.
 */
export function quebrarTexto(
  texto: string,
  largura: number,
  medir: (t: string) => number,
  maximo = 3,
): string[] {
  const linhas: string[] = [];
  let atual = "";
  const palavras = texto.replace(/\s+/g, " ").trim().split(" ");
  for (let i = 0; i < palavras.length; i++) {
    const p = palavras[i] ?? "";
    const tentativa = atual ? `${atual} ${p}` : p;
    if (medir(tentativa) <= largura) {
      atual = tentativa;
      continue;
    }
    if (atual) linhas.push(atual);
    atual = p;
    // Palavra maior que a coluna: corta no caractere.
    while (medir(atual) > largura && atual.length > 1) {
      let corte = atual.length - 1;
      while (corte > 1 && medir(atual.slice(0, corte)) > largura) corte--;
      linhas.push(atual.slice(0, corte));
      atual = atual.slice(corte);
    }
    if (linhas.length >= maximo) break;
  }
  if (atual && linhas.length < maximo) linhas.push(atual);
  const cortou =
    linhas.join(" ").replace(/\s/g, "").length <
    texto.replace(/\s/g, "").length;
  const final = linhas.slice(0, maximo);
  if (cortou && final.length) {
    let ultima = `${final[final.length - 1]}…`;
    while (medir(ultima) > largura && ultima.length > 1)
      ultima = `${ultima.slice(0, -2)}…`;
    final[final.length - 1] = ultima;
  }
  return final.length ? final : [""];
}

/** Troca o que a fonte padrão do PDF não desenha. */
const TROCAS: Record<string, string> = {
  "→": "->",
  "←": "<-",
  "✓": "v",
  "✕": "x",
  "≥": ">=",
  "≤": "<=",
  "−": "-",
  " ": " ",
  " ": " ",
};

export async function gerarPdf(d: DadosExportar): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  doc.setTitle(d.titulo);
  doc.setCreator("ARP Centralizador");
  doc.setCreationDate(d.geradoEm);
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);

  const seguro = (t: string) => {
    let s = "";
    for (const ch of t.normalize("NFC")) {
      const c = TROCAS[ch] ?? ch;
      try {
        fonte.encodeText(c);
        s += c;
      } catch {
        // fora da fonte: some
      }
    }
    return s;
  };

  const [larguraA4, alturaA4] = [595.28, 841.89];
  const [W, H] = emPaisagem(d.colunas)
    ? [alturaA4, larguraA4]
    : [larguraA4, alturaA4];
  const M = 36;
  const util = W - 2 * M;
  const TAM = 8;
  const ALT_LINHA = TAM + 3;
  const PAD = 4;
  const cinza = rgb(0.42, 0.42, 0.42);
  const preto = rgb(0.1, 0.1, 0.1);

  const textos = d.linhas.map((l) =>
    d.colunas.map((c, i) => seguro(textoDaCelula(l[i] ?? null, c))),
  );
  const cabecalhos = d.colunas.map((c) => seguro(c.titulo));
  const naturais = d.colunas.map((_, i) =>
    Math.min(
      Math.max(
        negrito.widthOfTextAtSize(cabecalhos[i] ?? "", TAM),
        ...textos.map((t) => fonte.widthOfTextAtSize(t[i] ?? "", TAM)),
      ) +
        2 * PAD,
      260,
    ),
  );
  const larguras = largurasDasColunas(naturais, util);
  const medir = (t: string) => fonte.widthOfTextAtSize(t, TAM);

  let pagina = doc.addPage([W, H]);
  let y = H - M;

  // Título e filtros só na primeira página.
  pagina.drawText(seguro(d.titulo), {
    x: M,
    y: y - 16,
    size: 16,
    font: negrito,
    color: preto,
  });
  y -= 24;
  if (d.filtros) {
    for (const l of quebrarTexto(seguro(d.filtros), util, (t) =>
      fonte.widthOfTextAtSize(t, 9),
    )) {
      pagina.drawText(l, {
        x: M,
        y: y - 9,
        size: 9,
        font: fonte,
        color: cinza,
      });
      y -= 12;
    }
  }
  y -= 8;

  const desenharCabecalho = () => {
    const altura = ALT_LINHA + 2 * PAD;
    pagina.drawRectangle({
      x: M,
      y: y - altura,
      width: util,
      height: altura,
      color: rgb(0.93, 0.93, 0.93),
    });
    let x = M;
    d.colunas.forEach((c, i) => {
      const w = larguras[i] ?? 0;
      const t =
        quebrarTexto(
          cabecalhos[i] ?? "",
          w - 2 * PAD,
          (s) => negrito.widthOfTextAtSize(s, TAM),
          1,
        )[0] ?? "";
      const tx = c.numero
        ? x + w - PAD - negrito.widthOfTextAtSize(t, TAM)
        : x + PAD;
      pagina.drawText(t, {
        x: tx,
        y: y - PAD - TAM,
        size: TAM,
        font: negrito,
        color: preto,
      });
      x += w;
    });
    y -= altura;
  };

  const rodape = 28;
  desenharCabecalho();
  textos.forEach((celulas, r) => {
    const quebradas = celulas.map((t, i) =>
      d.colunas[i]?.numero
        ? [t]
        : quebrarTexto(t, (larguras[i] ?? 0) - 2 * PAD, medir),
    );
    const altura =
      Math.max(...quebradas.map((q) => q.length), 1) * ALT_LINHA + 2 * PAD;
    if (y - altura < M + rodape) {
      pagina = doc.addPage([W, H]);
      y = H - M;
      desenharCabecalho();
    }
    if (r % 2 === 1)
      pagina.drawRectangle({
        x: M,
        y: y - altura,
        width: util,
        height: altura,
        color: rgb(0.975, 0.975, 0.975),
      });
    let x = M;
    quebradas.forEach((linhas, i) => {
      const w = larguras[i] ?? 0;
      linhas.forEach((t, k) => {
        const tx = d.colunas[i]?.numero
          ? x + w - PAD - fonte.widthOfTextAtSize(t, TAM)
          : x + PAD;
        pagina.drawText(t, {
          x: tx,
          y: y - PAD - TAM - k * ALT_LINHA,
          size: TAM,
          font: fonte,
          color: preto,
        });
      });
      x += w;
    });
    y -= altura;
  });

  if (y - 20 < M + rodape) {
    pagina = doc.addPage([W, H]);
    y = H - M;
  }
  pagina.drawText(seguro(textoTotal(d.linhas.length)), {
    x: M,
    y: y - 16,
    size: 9,
    font: negrito,
    color: preto,
  });

  // Rodapé de todas as páginas: quando foi gerado e a numeração.
  const paginas = doc.getPages();
  const gerado = textoGerado(d.geradoEm);
  paginas.forEach((p, i) => {
    p.drawText(gerado, { x: M, y: M - 14, size: 8, font: fonte, color: cinza });
    const num = `Página ${i + 1} de ${paginas.length}`;
    p.drawText(seguro(num), {
      x: W - M - fonte.widthOfTextAtSize(seguro(num), 8),
      y: M - 14,
      size: 8,
      font: fonte,
      color: cinza,
    });
  });

  return doc.save();
}
