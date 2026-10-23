import "server-only";
import type { ArquivoDoPacote } from "@/lib/os/importacao-modelo";
import {
  extrair,
  type FonteDeBytes,
  lerZip,
  pareceZip,
} from "@/lib/os/importacao-zip";
import { createAdminClient } from "@/lib/supabase/admin";
import { removerArquivos } from "../base";

// Arquivos da importação no bucket privado "os". O navegador envia direto
// para o bucket por um endereço assinado (um backup com fotos passa muito do
// limite de uma requisição ao servidor); o servidor lê depois, aos pedaços
// (Range), sem trazer o backup inteiro para a memória.

const BUCKET = "os";

export const pastaDaImportacao = (id: string) => `importacoes/${id}`;

/** Nome que o bucket aceita: sem acento, espaço nem símbolo. */
function nomeLimpo(nome: string): string {
  return (
    nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(-80) || "arquivo"
  );
}

export interface ArquivoEnviado {
  /** Nome original (o que os dados citam). */
  nome: string;
  path: string;
  tamanho: number;
}

export interface EnderecoDeEnvio extends ArquivoEnviado {
  url: string;
}

/** Endereços assinados para o navegador enviar cada arquivo (2 h). */
export async function enderecosDeEnvio(
  importacaoId: string,
  arquivos: { nome: string; tamanho: number }[],
): Promise<EnderecoDeEnvio[]> {
  const storage = createAdminClient().storage.from(BUCKET);
  return Promise.all(
    arquivos.map(async (a, i) => {
      const path = `${pastaDaImportacao(importacaoId)}/${String(i).padStart(4, "0")}-${nomeLimpo(a.nome)}`;
      const { data, error } = await storage.createSignedUploadUrl(path);
      if (error) throw new Error(`Envio de ${a.nome}: ${error.message}`);
      return { nome: a.nome, path, tamanho: a.tamanho, url: data.signedUrl };
    }),
  );
}

/** Quais arquivos chegaram de fato ao bucket (e com que tamanho). */
export async function arquivosNoBucket(
  importacaoId: string,
): Promise<Map<string, number>> {
  const { data, error } = await createAdminClient()
    .storage.from(BUCKET)
    .list(pastaDaImportacao(importacaoId), { limit: 1000 });
  if (error) throw new Error(`Arquivos enviados: ${error.message}`);
  return new Map(
    (data ?? []).map((o) => [
      `${pastaDaImportacao(importacaoId)}/${o.name}`,
      Number((o.metadata as { size?: number } | null)?.size ?? 0),
    ]),
  );
}

export async function apagarEnvio(importacaoId: string): Promise<void> {
  const paths = [...(await arquivosNoBucket(importacaoId)).keys()];
  if (!paths.length) return;
  const { error } = await createAdminClient()
    .storage.from(BUCKET)
    .remove(paths);
  if (error) console.error("apagar envio da importação", importacaoId, error);
}

/**
 * Leitura aos pedaços pelo endereço assinado (cabeçalho Range). Se o
 * servidor devolver o arquivo inteiro, guarda e corta daqui.
 */
async function fonteDoBucket(
  path: string,
  tamanho: number,
): Promise<FonteDeBytes> {
  const { data, error } = await createAdminClient()
    .storage.from(BUCKET)
    .createSignedUrl(path, 3600);
  if (error) throw new Error(`Leitura de ${path}: ${error.message}`);
  let inteiro: Uint8Array | null = null;
  return {
    tamanho,
    async ler(inicio, fim) {
      if (fim <= inicio) return new Uint8Array();
      if (inteiro) return inteiro.subarray(inicio, fim);
      const r = await fetch(data.signedUrl, {
        headers: { Range: `bytes=${inicio}-${fim - 1}` },
      });
      if (!r.ok) throw new Error(`Leitura de ${path}: HTTP ${r.status}`);
      const bytes = new Uint8Array(await r.arrayBuffer());
      if (r.status === 206) return bytes;
      inteiro = bytes;
      return bytes.subarray(inicio, fim);
    },
  };
}

/**
 * Todos os arquivos do pacote: os ZIPs abertos (cada entrada vira um
 * arquivo) e os enviados soltos, com o nome original.
 */
export async function abrirEnvio(
  importacaoId: string,
  enviados: ArquivoEnviado[],
): Promise<ArquivoDoPacote[]> {
  const noBucket = await arquivosNoBucket(importacaoId);
  const arquivos: ArquivoDoPacote[] = [];
  for (const e of enviados) {
    if (!noBucket.has(e.path))
      throw new Error(`O arquivo ${e.nome} não chegou. Envie de novo.`);
    // O tamanho que vale é o do bucket (o do navegador é só informativo).
    const tamanho = noBucket.get(e.path) || e.tamanho;
    const fonte = await fonteDoBucket(e.path, tamanho);
    const inicio = await fonte.ler(0, Math.min(4, tamanho));
    if (pareceZip(inicio)) {
      for (const entrada of await lerZip(fonte))
        arquivos.push({
          nome: entrada.nome,
          tamanho: entrada.tamanho,
          ler: () => extrair(fonte, entrada),
        });
    } else
      arquivos.push({
        nome: e.nome,
        tamanho,
        ler: () => fonte.ler(0, tamanho),
      });
  }
  return arquivos;
}

/** Grava um arquivo do pacote no bucket (foto ou assinatura importada). */
export async function gravarNoBucket(
  path: string,
  bytes: Uint8Array,
  mime: string,
): Promise<void> {
  const { error } = await createAdminClient()
    .storage.from(BUCKET)
    .upload(path, bytes, { contentType: mime, upsert: true });
  if (error) throw new Error(`Gravar ${path}: ${error.message}`);
}

/** Remove do bucket em lotes (o Storage recusa listas muito grandes). */
export async function removerEmLotes(paths: string[]): Promise<void> {
  for (let i = 0; i < paths.length; i += 500)
    await removerArquivos(paths.slice(i, i + 500));
}

/** Tipo do arquivo pela extensão (fotos e assinaturas do sistema atual). */
export function mimeDoArquivo(nome: string): string {
  const ext = nome.toLowerCase().split(".").at(-1) ?? "";
  return (
    {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      bmp: "image/bmp",
      pdf: "application/pdf",
    }[ext] ?? "application/octet-stream"
  );
}

export { nomeLimpo };
