import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  Arquivo,
  ArquivoEnviado,
  EXTENSOES_ARQUIVO,
} from "@/lib/formularios/campos";
import {
  BYTES_DO_TIPO,
  conteudoBateComExtensao,
  tipoPeloConteudo,
} from "@/lib/os/tipo-arquivo";
import {
  linkDeLeitura,
  listarArquivos,
  removerArquivos,
} from "@/server/arquivos";
import { podeAgora } from "@/server/auth";

// Arquivos das perguntas "Envio de arquivo": bucket privado "formularios",
// em <formulario_id>/<uuid>.<ext>. Quem responde sobe arquivo por arquivo
// (cada envio cabe no limite da Server Action) e recebe de volta uma
// assinatura do servidor; no envio final, só passa arquivo assinado para
// aquele formulário. A equipe baixa por link assinado de 5 minutos.

export const BUCKET_FORMULARIOS = "formularios" as const;

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

/**
 * Extensão e tipo do arquivo pelo nome, desde que o conteúdo confirme (um
 * HTML renomeado para .pdf não passa). Null se não for aceito.
 */
export function tipoDoArquivo(
  nome: string,
  inicio: Uint8Array,
): { ext: string; tipo: string } | null {
  const ext = nome.split(".").pop()?.toLowerCase() ?? "";
  const tipo = (ACEITOS as Record<string, string>)[ext];
  if (!tipo) return null;
  if (!conteudoBateComExtensao(nome, inicio.slice(0, BYTES_DO_TIPO)))
    return null;
  // Confere de novo os tipos de imagem pelo conteúdo (jpg × png trocados).
  const real = tipoPeloConteudo(inicio);
  if (tipo.startsWith("image/") && real !== tipo) return null;
  return { ext: ext === "jpeg" ? "jpg" : ext === "heif" ? "heic" : ext, tipo };
}

function chave(): string {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente");
  return k;
}

const texto = (a: Arquivo) => [a.caminho, a.nome, a.tamanho, a.tipo].join("\n");

/** Assinatura do servidor sobre o arquivo que acabou de subir. */
export function assinar(a: Arquivo): string {
  return createHmac("sha256", chave())
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
export function caminhosDasRespostas(
  respostas: Record<string, unknown>[],
): string[] {
  return respostas.flatMap((r) =>
    Object.values(r).flatMap((v) =>
      Array.isArray(v)
        ? v.flatMap((x) =>
            x && typeof x === "object" && "caminho" in x
              ? [String(x.caminho)]
              : [],
          )
        : [],
    ),
  );
}

/** Apaga arquivos do bucket (depois de conferir quem pede). */
export async function apagarArquivos(caminhos: string[]): Promise<void> {
  await removerArquivos(BUCKET_FORMULARIOS, caminhos);
}

/** Todos os arquivos de um formulário (para excluir junto). */
export async function arquivosDoFormulario(id: string): Promise<string[]> {
  return listarArquivos(BUCKET_FORMULARIOS, id);
}

/**
 * Link de 5 minutos para baixar um arquivo de resposta, para quem vê os
 * formulários (conferido agora no banco, antes da service role).
 */
export async function linkParaBaixar(
  formularioId: string,
  caminho: string,
  nome: string,
): Promise<string | null> {
  if (
    !/^[0-9a-f-]{36}$/.test(formularioId) ||
    !caminho.startsWith(`${formularioId}/`) ||
    !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/.test(caminho)
  )
    return null;
  const [ve, edita] = await Promise.all([
    podeAgora("formularios.ver"),
    podeAgora("formularios.editar"),
  ]);
  if (!ve && !edita) return null;
  return linkDeLeitura(BUCKET_FORMULARIOS, caminho, {
    segundos: 300,
    baixarComo: nome.replace(/[^\p{L}\p{N} ._()-]/gu, "").slice(0, 120) || true,
  });
}
