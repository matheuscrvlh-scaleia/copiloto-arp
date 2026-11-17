import { type FaturaLida, type ItemPdf, lerFaturaEnergisa } from "./energisa";

// Camada que lê o PDF: os textos de cada página com a posição (pdf.js, pelo
// unpdf). A interpretação fica em ./energisa.ts (pura, testável com textos
// sintéticos). Sem Next e sem banco: roda no servidor e nos testes.

/** Todo PDF começa com "%PDF". */
export function ehPdf(bytes: Uint8Array): boolean {
  return (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  );
}

/** Textos de cada página, com x, y (linha de base) e largura. */
export async function textosDoPdf(bytes: Uint8Array): Promise<ItemPdf[][]> {
  // Só quem importa fatura carrega o leitor de PDF.
  const { getDocumentProxy } = await import("unpdf");
  // O pdf.js toma posse do buffer: passa uma cópia.
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const paginas: ItemPdf[][] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const { items } = await (await pdf.getPage(p)).getTextContent();
    paginas.push(
      items.flatMap((i) =>
        "str" in i && i.str.trim()
          ? [{ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width }]
          : [],
      ),
    );
  }
  return paginas;
}

/** Lê a fatura direto dos bytes do PDF. */
export async function lerPdfEnergisa(
  bytes: Uint8Array,
  nomeArquivo?: string,
): Promise<FaturaLida> {
  return lerFaturaEnergisa(await textosDoPdf(bytes), nomeArquivo);
}
