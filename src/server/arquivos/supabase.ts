import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { ArquivoJaExiste } from "./disco";

// Supabase Storage pela service role: onde os arquivos ficavam até a VPS.
// Serve de armazenamento quando ARQUIVOS_DIR não está definido (Vercel e
// desenvolvimento) e de reserva de leitura enquanto a cópia para o disco não
// foi conferida. Só é chamado depois de conferida a permissão de quem pede.

const storage = (bucket: string) => createAdminClient().storage.from(bucket);

export async function gravar(
  bucket: string,
  caminho: string,
  conteudo: Uint8Array | Blob,
  tipo: string,
): Promise<void> {
  const { error } = await storage(bucket).upload(caminho, conteudo, {
    contentType: tipo,
    upsert: false,
  });
  if (!error) return;
  if (/exists|duplicate/i.test(error.message)) throw new ArquivoJaExiste();
  throw new Error(`Falha ao enviar o arquivo: ${error.message}`);
}

export async function ler(
  bucket: string,
  caminho: string,
): Promise<Blob | null> {
  const { data, error } = await storage(bucket).download(caminho);
  return error || !data ? null : data;
}

export async function inicio(
  bucket: string,
  caminho: string,
  bytes: number,
): Promise<Uint8Array | null> {
  const link = await storage(bucket).createSignedUrl(caminho, 60);
  if (link.error || !link.data) return null;
  const r = await fetch(link.data.signedUrl, {
    headers: { Range: `bytes=0-${bytes - 1}` },
  }).catch(() => null);
  if (!r?.ok) return null;
  return new Uint8Array(await r.arrayBuffer()).slice(0, bytes);
}

export async function info(
  bucket: string,
  caminho: string,
): Promise<{ tamanho: number; tipo: string } | null> {
  const { data, error } = await storage(bucket).info(caminho);
  if (error || !data) return null;
  return {
    tamanho: data.size ?? 0,
    tipo: data.contentType ?? "application/octet-stream",
  };
}

export async function remover(
  bucket: string,
  caminhos: string[],
): Promise<boolean> {
  const { error } = await storage(bucket).remove(caminhos);
  if (error) console.error("remover arquivos no Supabase", bucket, error);
  return !error;
}

export async function listar(bucket: string, pasta: string): Promise<string[]> {
  const caminhos: string[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await storage(bucket).list(pasta, {
      limit: 1000,
      offset: de,
    });
    if (error) throw error;
    // id null é subpasta.
    for (const f of data ?? []) if (f.id) caminhos.push(`${pasta}/${f.name}`);
    if ((data?.length ?? 0) < 1000) return caminhos;
  }
}

export async function link(
  bucket: string,
  caminho: string,
  segundos: number,
  baixarComo?: string,
): Promise<string | null> {
  const { data, error } = await storage(bucket).createSignedUrl(
    caminho,
    segundos,
    baixarComo ? { download: baixarComo } : undefined,
  );
  return error || !data ? null : data.signedUrl;
}

export async function links(
  bucket: string,
  caminhos: string[],
  segundos: number,
): Promise<Map<string, string>> {
  if (!caminhos.length) return new Map();
  const { data, error } = await storage(bucket).createSignedUrls(
    caminhos,
    segundos,
  );
  if (error) {
    console.error("links assinados do Supabase", bucket, error);
    return new Map();
  }
  return new Map(
    (data ?? [])
      .filter((d) => d.signedUrl && d.path && !d.error)
      .map((d) => [d.path as string, d.signedUrl as string]),
  );
}

export async function linkDeEnvio(
  bucket: string,
  caminho: string,
): Promise<{ url: string } | { erro: "existe" | "falha" }> {
  const { data, error } = await storage(bucket).createSignedUploadUrl(caminho);
  if (!error && data) return { url: data.signedUrl };
  console.error("link de envio do Supabase", bucket, error);
  return { erro: /exists/i.test(error?.message ?? "") ? "existe" : "falha" };
}
