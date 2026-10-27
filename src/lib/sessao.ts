import { DURACAO_MAXIMA_MS, INATIVIDADE_MS } from "@/config/sessao";

/**
 * Prazo da sessão. O Supabase renova o token para sempre; quem corta é o
 * proxy, com este cookie assinado: quem é, quando entrou e quando mexeu pela
 * última vez. Sem cookie, com assinatura errada ou de outra pessoa, a sessão
 * é tratada como vencida (apagar o cookie não prolonga nada).
 */
export const COOKIE_SESSAO = "arp_sessao";

export const OPCOES_COOKIE_SESSAO = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: DURACAO_MAXIMA_MS / 1000,
} as const;

export interface PrazoDaSessao {
  sub: string;
  inicio: number;
  ultima: number;
}

let chave: Promise<CryptoKey> | undefined;

function chaveDaSessao(): Promise<CryptoKey> {
  chave ??= (async () => {
    const valor = process.env.SESSAO_CHAVE;
    const bytes = valor
      ? Uint8Array.from(atob(valor), (c) => c.charCodeAt(0))
      : null;
    if (!bytes || bytes.length < 32) {
      throw new Error("SESSAO_CHAVE ausente ou curta: use 32 bytes em base64");
    }
    return crypto.subtle.importKey(
      "raw",
      bytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
  })();
  chave.catch(() => {
    chave = undefined;
  });
  return chave;
}

const texto = (s: string) => new TextEncoder().encode(s);
const corpo = (p: PrazoDaSessao) => `${p.sub}.${p.inicio}.${p.ultima}`;

function paraBase64Url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function deBase64Url(s: string): Uint8Array<ArrayBuffer> | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

export async function assinarSessao(p: PrazoDaSessao): Promise<string> {
  const assinatura = await crypto.subtle.sign(
    "HMAC",
    await chaveDaSessao(),
    texto(corpo(p)),
  );
  return `${corpo(p)}.${paraBase64Url(assinatura)}`;
}

/** Lê o cookie; null se faltar, estiver malformado ou a assinatura não bater. */
export async function lerSessao(
  valor: string | undefined,
): Promise<PrazoDaSessao | null> {
  const partes = valor?.split(".");
  if (partes?.length !== 4) return null;
  const [sub = "", inicio, ultima, assinatura = ""] = partes;
  const p = { sub, inicio: Number(inicio), ultima: Number(ultima) };
  const bytes = deBase64Url(assinatura);
  if (
    !sub ||
    !Number.isSafeInteger(p.inicio) ||
    !Number.isSafeInteger(p.ultima) ||
    !bytes
  )
    return null;
  const ok = await crypto.subtle.verify(
    "HMAC",
    await chaveDaSessao(),
    bytes,
    texto(corpo(p)),
  );
  return ok ? p : null;
}

/** Vencida: sem prazo válido, de outra pessoa, passou de 8h ou de 30 min parada. */
export function sessaoVencida(
  p: PrazoDaSessao | null,
  sub: string,
  agora: number,
): boolean {
  return (
    !p ||
    p.sub !== sub ||
    agora - p.inicio > DURACAO_MAXIMA_MS ||
    agora - p.ultima > INATIVIDADE_MS
  );
}
