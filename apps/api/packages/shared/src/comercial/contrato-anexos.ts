import { textoNormal } from "./contrato-esquema";

// ---------------------------------------------------------------------------
// Anexos (bucket "comercial", contratos/<id>/...)
// ---------------------------------------------------------------------------

export const TIPOS_ANEXO = {
  planta: "Planta do imóvel (Anexo I)",
  vistoria: "Termo ou laudo de vistoria de entrada",
  garantia: "Documento da garantia",
  comprovante_caucao: "Comprovante do depósito da caução",
  comprovante_capitalizacao: "Comprovante de pagamento da capitalização",
  apolice: "Documento da apólice",
  credencial: "Termo de entrega e uso de credencial",
  outro: "Outro anexo",
} as const;
export type TipoAnexo = keyof typeof TIPOS_ANEXO;

export const ANEXO_MAX_BYTES = 25 * 1024 * 1024;
const MIMES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
export const ACEITA_ANEXO = Object.keys(MIMES)
  .map((e) => `.${e}`)
  .join(",");

/** Tipo do arquivo pela extensão (null se não aceito). */
export function mimeDoAnexo(nome: string): string | null {
  const ext = nome.toLowerCase().split(".").pop() ?? "";
  return MIMES[ext] ?? null;
}

/** Nome sem acento nem espaço, para o caminho no bucket. */
export function nomeDoArquivo(nome: string): string {
  const limpo = textoNormal(nome)
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return (limpo || "arquivo").slice(-80);
}
