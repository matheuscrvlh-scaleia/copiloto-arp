// Regras HTTP da rota que serve os arquivos. Sem "server-only" para os
// testes de unidade importarem direto.

export const TIPO_PADRAO = "application/octet-stream";

const TIPO_VALIDO = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/;

/**
 * Tipos que o navegador pode mostrar na própria aba. Os arquivos agora saem
 * da mesma origem do sistema: HTML, SVG e afins sempre baixam (um SVG ou
 * HTML enviado por alguém rodaria script com a sessão de quem abrisse).
 */
const MOSTRAVEIS = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "text/plain",
]);

/** Tipo limpo (minúsculo, sem parâmetros) ou o genérico. */
export function tipoLimpo(tipo: string | null | undefined): string {
  const t = (tipo ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  return TIPO_VALIDO.test(t) ? t : TIPO_PADRAO;
}

export function podeMostrar(tipo: string): boolean {
  return MOSTRAVEIS.has(tipo);
}

/** Content-Disposition com o nome em ASCII e em UTF-8 (RFC 6266). */
export function disposicao(
  modo: "inline" | "attachment",
  nome?: string,
): string {
  if (!nome) return modo;
  const ascii = nome.replace(/[^\x20-\x7e]|["\\%]/g, "_");
  return `${modo}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`;
}

/**
 * Cabeçalho Range com um trecho só ("bytes=0-99", "bytes=100-",
 * "bytes=-50"). null: devolve o arquivo inteiro; "invalida": 416.
 */
export function lerFaixa(
  cabecalho: string | null,
  tamanho: number,
): { inicio: number; fim: number } | "invalida" | null {
  if (!cabecalho) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(cabecalho.trim());
  if (!m) return null;
  const [, a = "", b = ""] = m;
  if (a === "" && b === "") return null;
  let inicio: number;
  let fim: number;
  if (a === "") {
    const ultimos = Number(b);
    if (ultimos === 0) return "invalida";
    inicio = Math.max(0, tamanho - ultimos);
    fim = tamanho - 1;
  } else {
    inicio = Number(a);
    fim = b === "" ? tamanho - 1 : Math.min(Number(b), tamanho - 1);
  }
  if (inicio > fim || inicio >= tamanho) return "invalida";
  return { inicio, fim };
}
