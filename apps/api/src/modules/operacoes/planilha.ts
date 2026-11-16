import { createHash } from "node:crypto";
import { decodificarTexto, lerCsv } from "@arp/shared/marketing/parametros";
import type { Aba, Celula } from "@arp/shared/operacoes/agua";

// Leitura dos arquivos enviados nas importações de Operações: as abas de um
// .xlsx (ou o .csv como uma aba só), o texto de um PDF e o sha256.

export const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

const celula = (v: unknown): Celula =>
  v instanceof Date ||
  typeof v === "string" ||
  typeof v === "number" ||
  typeof v === "boolean"
    ? v
    : null;

/** Abas de um .xlsx ou de um .csv (uma aba só). */
export async function lerAbas(bytes: Uint8Array, nome: string): Promise<Aba[]> {
  if (/\.csv$/i.test(nome))
    return [{ nome, linhas: lerCsv(decodificarTexto(bytes)) }];
  const { default: readXlsxFile } = await import("read-excel-file/node");
  const abas = await readXlsxFile(Buffer.from(bytes));
  return abas.map((a) => ({
    nome: a.sheet,
    linhas: a.data.map((linha) => linha.map(celula)),
  }));
}

/** Linhas de texto de cada página (itens agrupados pela altura). */
export async function paginasDoPdf(bytes: Uint8Array): Promise<string[]> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const paginas: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const { items } = await (await pdf.getPage(p)).getTextContent();
    const linhas = new Map<number, { x: number; t: string }[]>();
    for (const i of items) {
      if (!("str" in i) || !i.str.trim()) continue;
      const y = Math.round(i.transform[5] / 3) * 3;
      const lista = linhas.get(y) ?? [];
      lista.push({ x: i.transform[4], t: i.str.trim() });
      linhas.set(y, lista);
    }
    paginas.push(
      [...linhas.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, l]) =>
          l
            .sort((a, b) => a.x - b.x)
            .map((x) => x.t)
            .join(" "),
        )
        .join("\n"),
    );
  }
  return paginas;
}
