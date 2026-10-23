// Fotos tiradas no celular chegam com 4 a 12 MB: antes de enviar, o
// navegador reduz para o lado maior em ~1600 px e JPEG 0,8 (fica legível e
// sobe rápido no 4G do técnico). Outros arquivos vão como estão.

const LADO_MAIOR = 1600;
const QUALIDADE = 0.8;
/** A Vercel recusa requisições acima de 4,5 MB: cada envio fica em 4 MB. */
export const LIMITE_ENVIO = 4 * 1024 * 1024;

function carregar(arquivo: File): Promise<HTMLImageElement> {
  return new Promise((ok, falha) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      ok(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      falha(new Error("imagem ilegível"));
    };
    img.src = url;
  });
}

/** Foto reduzida em JPEG; GIF e o que não der para ler vão como estão. */
export async function reduzirFoto(arquivo: File): Promise<File> {
  if (!arquivo.type.startsWith("image/") || arquivo.type === "image/gif")
    return arquivo;
  try {
    const img = await carregar(arquivo);
    const escala = Math.min(
      1,
      LADO_MAIOR / Math.max(img.naturalWidth, img.naturalHeight),
    );
    const largura = Math.round(img.naturalWidth * escala);
    const altura = Math.round(img.naturalHeight * escala);
    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    canvas.getContext("2d")?.drawImage(img, 0, 0, largura, altura);
    const blob = await new Promise<Blob | null>((ok) =>
      canvas.toBlob(ok, "image/jpeg", QUALIDADE),
    );
    if (!blob || blob.size >= arquivo.size) return arquivo;
    const nome = arquivo.name.replace(/\.[^.]+$/, "") || "foto";
    return new File([blob], `${nome}.jpg`, { type: "image/jpeg" });
  } catch {
    return arquivo;
  }
}

export async function reduzirFotos(arquivos: File[]): Promise<File[]> {
  return Promise.all(arquivos.map(reduzirFoto));
}

export function tamanhoTotal(arquivos: File[]): number {
  return arquivos.reduce((s, a) => s + a.size, 0);
}

/** 1536000 → "1,5 MB". */
export function formatarTamanho(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
