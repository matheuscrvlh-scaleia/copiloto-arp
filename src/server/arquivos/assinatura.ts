import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { BUCKETS, caminhoValido } from "./caminho";

// Links assinados dos arquivos guardados no disco. O token leva o que se
// pode fazer (ler ou enviar),
// o arquivo e o prazo, e um HMAC-SHA256 com ARQUIVOS_CHAVE. Quem gera o link
// já conferiu a permissão; a rota só confere a assinatura e o prazo.
// Sem "server-only" para os testes de unidade importarem direto.

export type Permissao =
  | { op: "ler"; bucket: string; caminho: string; baixarComo?: string }
  | { op: "enviar"; bucket: string; caminho: string; maxBytes: number };

const caminho = z.string().refine(caminhoValido);
const corpo = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("ler"),
    bucket: z.enum(BUCKETS),
    caminho,
    baixarComo: z.string().min(1).max(255).optional(),
    exp: z.number().int(),
  }),
  z.object({
    op: z.literal("enviar"),
    bucket: z.enum(BUCKETS),
    caminho,
    maxBytes: z.number().int().positive(),
    exp: z.number().int(),
  }),
]);

export type PermissaoConferida = z.infer<typeof corpo>;

// atalho: em desenvolvimento, sem ARQUIVOS_CHAVE, uma chave por processo
// (os links abertos vencem quando o servidor reinicia). Em produção, falta
// da chave é erro.
let chaveDeDesenvolvimento: Buffer | undefined;

function chave(): Buffer {
  const valor = process.env.ARQUIVOS_CHAVE?.trim();
  if (!valor) {
    if (process.env.NODE_ENV !== "production") {
      chaveDeDesenvolvimento ??= randomBytes(32);
      return chaveDeDesenvolvimento;
    }
    throw new Error(
      "Arquivos não configurados: defina ARQUIVOS_CHAVE (32 bytes em base64)",
    );
  }
  const bytes = Buffer.from(valor, "base64");
  if (bytes.length !== 32)
    throw new Error("ARQUIVOS_CHAVE precisa ter 32 bytes em base64");
  return bytes;
}

function mac(corpoB64: string): string {
  // O prefixo separa estes tokens de qualquer outro HMAC com a mesma chave.
  return createHmac("sha256", chave())
    .update(`arquivos:v1:${corpoB64}`)
    .digest("base64url");
}

export function assinar(
  permissao: Permissao,
  segundos: number,
  agora = Date.now(),
): string {
  const exp = Math.floor(agora / 1000) + Math.max(1, Math.floor(segundos));
  const corpoB64 = Buffer.from(JSON.stringify({ ...permissao, exp })).toString(
    "base64url",
  );
  return `${corpoB64}.${mac(corpoB64)}`;
}

/** A permissão do token, ou null se a assinatura não bate ou o prazo passou. */
export function conferir(
  token: string,
  agora = Date.now(),
): PermissaoConferida | null {
  if (token.length > 4096) return null;
  const partes = token.split(".");
  if (partes.length !== 2) return null;
  const [corpoB64, assinatura] = partes as [string, string];
  const esperada = Buffer.from(mac(corpoB64));
  const recebida = Buffer.from(assinatura);
  if (
    esperada.length !== recebida.length ||
    !timingSafeEqual(esperada, recebida)
  )
    return null;
  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(corpoB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const lido = corpo.safeParse(json);
  if (!lido.success) return null;
  if (lido.data.exp <= Math.floor(agora / 1000)) return null;
  return lido.data;
}
