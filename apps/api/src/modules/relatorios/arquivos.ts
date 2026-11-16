import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  Arquivo,
  ArquivoEnviado,
  EXTENSOES_ARQUIVO,
} from "@arp/shared/formularios/campos";
import {
  BYTES_DO_TIPO,
  conteudoBateComExtensao,
  tipoPeloConteudo,
} from "@arp/shared/os/tipo-arquivo";
import { env } from "@/config/env";
import type { Bucket } from "@/infra/arquivos";

// Arquivos das perguntas "Envio de arquivo": bucket "formularios", em
// <formulario_id>/<uuid>.<ext> (os mesmos caminhos de antes). Quem responde
// sobe arquivo por arquivo e recebe de volta uma assinatura do servidor; no
// envio final só passa arquivo assinado para aquele formulário. A equipe
// baixa por link assinado de 5 minutos.

export const BUCKET: Bucket = "formularios";

/** Tipo gravado de cada extensão aceita. */
const ACEITOS: Record<(typeof EXTENSOES_ARQUIVO)[number], string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heic",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const aceita = (ext: string): ext is keyof typeof ACEITOS =>
  Object.hasOwn(ACEITOS, ext);

/**
 * Extensão e tipo do arquivo pelo nome, desde que o conteúdo confirme (um
 * HTML renomeado para .pdf não passa). Null se não for aceito.
 */
export function tipoDoArquivo(
  nome: string,
  inicio: Uint8Array,
): { ext: string; tipo: string } | null {
  const ext = nome.split(".").pop()?.toLowerCase() ?? "";
  if (!aceita(ext)) return null;
  const tipo = ACEITOS[ext];
  if (!conteudoBateComExtensao(nome, inicio.slice(0, BYTES_DO_TIPO)))
    return null;
  // Confere de novo os tipos de imagem pelo conteúdo (jpg × png trocados).
  const real = tipoPeloConteudo(inicio);
  if (tipo.startsWith("image/") && real !== tipo) return null;
  return { ext: ext === "jpeg" ? "jpg" : ext === "heif" ? "heic" : ext, tipo };
}

const texto = (a: Arquivo) => [a.caminho, a.nome, a.tamanho, a.tipo].join("\n");

/** Assinatura do servidor sobre o arquivo que acabou de subir. */
export function assinar(a: Arquivo): string {
  // Mesma chave dos links de arquivo, com outro prefixo: um token não serve
  // no lugar do outro.
  return createHmac("sha256", Buffer.from(env.ARQUIVOS_CHAVE, "base64"))
    .update(`formularios:arquivo\n${texto(a)}`)
    .digest("base64url");
}

/** O arquivo veio deste servidor e é do formulário? */
export function conferirAssinatura(
  formularioId: string,
): (a: ArquivoEnviado) => boolean {
  return (a) => {
    if (!a.caminho.startsWith(`${formularioId}/`)) return false;
    const esperado = Buffer.from(assinar(a));
    const veio = Buffer.from(a.assinatura);
    return esperado.length === veio.length && timingSafeEqual(esperado, veio);
  };
}

/** Caminhos de arquivo dentro de um conjunto de respostas gravadas. */
export function caminhosDasRespostas(respostas: unknown[]): string[] {
  return respostas.flatMap((r) =>
    r && typeof r === "object"
      ? Object.values(r).flatMap((v: unknown) =>
          Array.isArray(v)
            ? v.flatMap((x: unknown) =>
                x && typeof x === "object" && "caminho" in x
                  ? [String(x.caminho)]
                  : [],
              )
            : [],
        )
      : [],
  );
}

/** Nome para salvar o arquivo: só letras, números e pontuação simples. */
export const nomeLimpo = (nome: string) =>
  nome.replace(/[^\p{L}\p{N} ._()-]/gu, "");
