import { createHash } from "node:crypto";
import type { ItemTexto } from "@arp/shared/rh/folha/extrato";
import type { AbaDaPlanilha, Celula } from "@arp/shared/rh/plano";

// Arquivos das importações do RH (folha.ts e beneficios.ts do antigo): o
// bucket privado, o limite, o hash e a leitura de PDF e .xlsx. Os leitores
// só carregam quando alguém importa.

export const BUCKET = "importacoes" as const;
export const TAMANHO_MAXIMO = 10 * 1024 * 1024;

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Todo PDF começa com "%PDF". */
export function ehPdf(bytes: Uint8Array): boolean {
  return (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  );
}

/** .xlsx é um zip: começa com "PK\x03\x04". */
export function ehXlsx(bytes: Uint8Array): boolean {
  return (
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}

/** Nome do arquivo para o caminho no disco (sem acento nem espaço). */
export function nomeNoDisco(nome: string, padrao: string): string {
  return (
    nome
      .normalize("NFD")
      .replace(/[^\w.-]+/g, "_")
      .slice(-80) || padrao
  );
}

/** Textos de cada página do PDF, com posição. */
export async function textosDoPdf(bytes: Uint8Array): Promise<ItemTexto[][]> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const paginas: ItemTexto[][] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const { items } = await (await pdf.getPage(p)).getTextContent();
    paginas.push(
      items.flatMap((i) =>
        "str" in i
          ? [{ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width }]
          : [],
      ),
    );
  }
  return paginas;
}

const celula = (v: unknown): Celula =>
  typeof v === "string" || typeof v === "number" || typeof v === "boolean"
    ? v
    : v instanceof Date
      ? v
      : null;

/** Todas as abas do .xlsx, no formato das regras de @arp/shared/rh. */
export async function abasDoXlsx(bytes: Uint8Array): Promise<AbaDaPlanilha[]> {
  const { default: readXlsxFile } = await import("read-excel-file/node");
  const abas = await readXlsxFile(Buffer.from(bytes));
  return abas.map((a) => ({
    sheet: a.sheet,
    data: a.data.map((linha) => linha.map(celula)),
  }));
}
