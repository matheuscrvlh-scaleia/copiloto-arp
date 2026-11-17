// Tipo do arquivo pelo conteúdo (os primeiros bytes), não pelo que o
// navegador declara nem pela extensão: um HTML ou SVG renomeado para .png
// não passa por foto.

/** Bytes que bastam para reconhecer os formatos abaixo. */
export const BYTES_DO_TIPO = 16;

const comeca = (b: Uint8Array, assinatura: number[], de = 0) =>
  assinatura.every((v, i) => b[de + i] === v);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** Formatos HEIC/HEIF (marca do "ftyp" das fotos de iPhone). */
const MARCAS_HEIC = ["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"];

/** Tipo reconhecido pelo começo do arquivo; null se não for nenhum dos aceitos. */
export function tipoPeloConteudo(b: Uint8Array): string | null {
  if (comeca(b, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (comeca(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return "image/png";
  if (comeca(b, ascii("GIF8"))) return "image/gif";
  if (comeca(b, ascii("RIFF")) && comeca(b, ascii("WEBP"), 8))
    return "image/webp";
  if (comeca(b, ascii("ftyp"), 4)) {
    const marca = String.fromCharCode(...b.slice(8, 12));
    if (MARCAS_HEIC.includes(marca)) return "image/heic";
  }
  if (comeca(b, ascii("%PDF"))) return "application/pdf";
  // ZIP: também docx e xlsx.
  if (comeca(b, [0x50, 0x4b, 0x03, 0x04])) return "application/zip";
  // OLE: doc e xls antigos.
  if (comeca(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
    return "application/x-ole-storage";
  if (comeca(b, ascii("AC10"))) return "application/acad";
  return null;
}

/** Tipo que cada extensão do portal pode ter pelo conteúdo. */
const CONTEUDO_DA_EXTENSAO: Record<string, (tipo: string | null) => boolean> = {
  jpg: (t) => t === "image/jpeg",
  jpeg: (t) => t === "image/jpeg",
  png: (t) => t === "image/png",
  webp: (t) => t === "image/webp",
  heic: (t) => t === "image/heic",
  heif: (t) => t === "image/heic",
  pdf: (t) => t === "application/pdf",
  dwg: (t) => t === "application/acad",
  // DXF é texto: basta não ser outra coisa conhecida.
  dxf: (t) => t === null,
  doc: (t) => t === "application/x-ole-storage",
  xls: (t) => t === "application/x-ole-storage",
  docx: (t) => t === "application/zip",
  xlsx: (t) => t === "application/zip",
  zip: (t) => t === "application/zip",
};

/** O conteúdo bate com a extensão do nome? */
export function conteudoBateComExtensao(nome: string, b: Uint8Array): boolean {
  const ext = nome.split(".").pop()?.toLowerCase() ?? "";
  return CONTEUDO_DA_EXTENSAO[ext]?.(tipoPeloConteudo(b)) ?? false;
}

/** Os primeiros bytes de um arquivo enviado. */
export async function inicioDoArquivo(f: Blob): Promise<Uint8Array> {
  return new Uint8Array(await f.slice(0, BYTES_DO_TIPO).arrayBuffer());
}
