import "server-only";
import ExcelJS from "exceljs";
import type { Celula } from "@/lib/os/relatorios";

// Estilo das planilhas que Operações já usa (spec 4.16 D): faixa azul no
// topo, linha de instrução em amarelo claro e cabeçalho azul com letra
// branca em negrito.

export const COR = {
  faixa: "FF0B3C72",
  cabecalho: "FF0B57A4",
  nota: "FFFFF2CC",
  branco: "FFFFFFFF",
} as const;

export const MOEDA = '"R$" #,##0.00';
export const MOEDA_MINUTO = '"R$" #,##0.0000';

export function novoLivro(): ExcelJS.Workbook {
  const livro = new ExcelJS.Workbook();
  livro.creator = "ARP Centralizador";
  livro.created = new Date();
  return livro;
}

const preenchido = (argb: string): ExcelJS.Fill => ({
  type: "pattern",
  pattern: "solid",
  fgColor: { argb },
});

/** Linha inteira mesclada de `de` a `ate` (colunas) com um texto. */
export function faixa(
  aba: ExcelJS.Worksheet,
  linha: number,
  de: number,
  ate: number,
  texto: string,
  tipo: "titulo" | "nota",
) {
  aba.mergeCells(linha, de, linha, ate);
  const c = aba.getCell(linha, de);
  c.value = texto;
  if (tipo === "titulo") {
    c.fill = preenchido(COR.faixa);
    c.font = { bold: true, size: 13, color: { argb: COR.branco } };
    aba.getRow(linha).height = 24;
  } else {
    c.fill = preenchido(COR.nota);
    c.font = { italic: true, size: 10, color: { argb: "FF5A4A00" } };
    aba.getRow(linha).height = 20;
  }
  c.alignment = { vertical: "middle", wrapText: tipo === "nota" };
}

/** Cabeçalho azul, letra branca em negrito. */
export function cabecalho(
  aba: ExcelJS.Worksheet,
  linha: number,
  colunaInicial: number,
  titulos: readonly string[],
) {
  titulos.forEach((t, i) => {
    const c = aba.getCell(linha, colunaInicial + i);
    c.value = t;
    c.fill = preenchido(COR.cabecalho);
    c.font = { bold: true, color: { argb: COR.branco } };
    c.alignment = { vertical: "middle", wrapText: true };
    c.border = { bottom: { style: "thin", color: { argb: COR.faixa } } };
  });
  aba.getRow(linha).height = 22;
}

/** Linhas de dados a partir de uma linha/coluna. */
export function linhas(
  aba: ExcelJS.Worksheet,
  inicio: number,
  colunaInicial: number,
  dados: Celula[][],
) {
  dados.forEach((l, i) => {
    l.forEach((v, j) => {
      aba.getCell(inicio + i, colunaInicial + j).value = v ?? "";
    });
  });
}

/** Formato e largura das colunas (1 = A). */
export function colunas(
  aba: ExcelJS.Worksheet,
  defs: { largura: number; formato?: string; quebra?: boolean }[],
  colunaInicial = 1,
) {
  defs.forEach((d, i) => {
    const col = aba.getColumn(colunaInicial + i);
    col.width = d.largura;
    if (d.formato) col.numFmt = d.formato;
    if (d.quebra) col.alignment = { wrapText: true, vertical: "top" };
  });
}

export async function paraBytes(livro: ExcelJS.Workbook): Promise<Uint8Array> {
  return new Uint8Array(await livro.xlsx.writeBuffer());
}

export const TIPO_XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
