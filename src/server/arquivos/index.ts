import "server-only";
import { urlDoSistema } from "@/server/endereco";
import { assinar } from "./assinatura";
import { type Bucket, caminhoValido, nomeDoCaminho } from "./caminho";
import { comReserva, noDisco } from "./config";
import { ArquivoJaExiste, type Disco } from "./disco";
import * as supabase from "./supabase";

// Ponto único de acesso aos arquivos (fotos, PDFs, planilhas). O resto do
// sistema não fala com o Supabase Storage nem com o disco direto: chama
// estas funções, sempre DEPOIS de conferir a permissão de quem pede (aqui
// não há RLS). Onde os arquivos ficam: ./config.ts.

export type { Bucket } from "./caminho";
export { ArquivoJaExiste } from "./disco";

type Conteudo = Uint8Array | ArrayBuffer | Blob;

async function bytesDe(conteudo: Conteudo): Promise<Uint8Array> {
  if (conteudo instanceof Uint8Array) return conteudo;
  if (conteudo instanceof ArrayBuffer) return new Uint8Array(conteudo);
  return new Uint8Array(await conteudo.arrayBuffer());
}

/** Grava um arquivo novo; nunca sobrescreve (ArquivoJaExiste). */
export async function gravarArquivo(
  bucket: Bucket,
  caminho: string,
  conteudo: Conteudo,
  tipo: string,
): Promise<void> {
  if (!caminhoValido(caminho))
    throw new Error(`Caminho de arquivo inválido: ${caminho}`);
  const d = noDisco();
  if (d) {
    await d.gravar(bucket, caminho, await bytesDe(conteudo), { tipo });
    return;
  }
  await supabase.gravar(
    bucket,
    caminho,
    conteudo instanceof ArrayBuffer ? new Uint8Array(conteudo) : conteudo,
    tipo,
  );
}

/** Lê do Supabase o que ainda não veio para o disco, e já deixa a cópia. */
async function trazerDoSupabase(
  d: Disco,
  bucket: Bucket,
  caminho: string,
): Promise<Uint8Array | null> {
  const blob = await supabase.ler(bucket, caminho);
  if (!blob) return null;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  await d
    .gravar(bucket, caminho, bytes, {
      tipo: blob.type || undefined,
      origem: "supabase",
    })
    .catch((e) => {
      if (!(e instanceof ArquivoJaExiste))
        console.error("copiar arquivo do Supabase", bucket, caminho, e);
    });
  return bytes;
}

export async function lerArquivo(
  bucket: Bucket,
  caminho: string,
): Promise<Uint8Array | null> {
  if (!caminhoValido(caminho)) return null;
  const d = noDisco();
  if (!d) {
    const blob = await supabase.ler(bucket, caminho);
    return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
  }
  const local = await d.ler(bucket, caminho);
  if (local || !comReserva()) return local;
  return trazerDoSupabase(d, bucket, caminho);
}

/** Os primeiros bytes (conferir o tipo pelo conteúdo sem ler tudo). */
export async function inicioDoArquivo(
  bucket: Bucket,
  caminho: string,
  bytes: number,
): Promise<Uint8Array | null> {
  if (!caminhoValido(caminho)) return null;
  const d = noDisco();
  if (!d) return supabase.inicio(bucket, caminho, bytes);
  const local = await d.inicio(bucket, caminho, bytes);
  if (local || !comReserva()) return local;
  return supabase.inicio(bucket, caminho, bytes);
}

export async function infoDoArquivo(
  bucket: Bucket,
  caminho: string,
): Promise<{ tamanho: number; tipo: string } | null> {
  if (!caminhoValido(caminho)) return null;
  const d = noDisco();
  if (!d) return supabase.info(bucket, caminho);
  const local = await d.info(bucket, caminho);
  if (local) return { tamanho: local.tamanho, tipo: local.tipo };
  return comReserva() ? supabase.info(bucket, caminho) : null;
}

/**
 * Apaga os arquivos (no disco e, na transição, também no Supabase, para a
 * migração não trazer de volta o que foi apagado). false se algo falhou.
 */
export async function removerArquivos(
  bucket: Bucket,
  caminhos: string[],
): Promise<boolean> {
  const validos = caminhos.filter((c) => caminhoValido(c));
  if (!validos.length) return true;
  const d = noDisco();
  if (!d) return supabase.remover(bucket, validos);
  let ok = true;
  try {
    await d.remover(bucket, validos);
  } catch (e) {
    console.error("remover arquivos do disco", bucket, e);
    ok = false;
  }
  if (comReserva()) ok = (await supabase.remover(bucket, validos)) && ok;
  return ok;
}

/** Caminhos dos arquivos direto dentro da pasta. */
export async function listarArquivos(
  bucket: Bucket,
  pasta: string,
): Promise<string[]> {
  if (!caminhoValido(pasta)) return [];
  const d = noDisco();
  if (!d) return supabase.listar(bucket, pasta);
  const [local, remoto] = await Promise.all([
    d.listar(bucket, pasta),
    comReserva() ? supabase.listar(bucket, pasta) : Promise.resolve([]),
  ]);
  return [...new Set([...local, ...remoto])].sort();
}

function linkDoDisco(
  bucket: Bucket,
  caminho: string,
  segundos: number,
  baixarComo?: string,
): string {
  const token = assinar(
    {
      op: "ler",
      bucket,
      caminho,
      ...(baixarComo ? { baixarComo: baixarComo.slice(0, 255) } : {}),
    },
    segundos,
  );
  return urlDoSistema(`/api/arquivos/${token}`);
}

/**
 * Link temporário (endereço absoluto) para ver ou baixar o arquivo; null se
 * o arquivo não existe. `baixarComo` força o download com esse nome (true:
 * o nome do próprio arquivo).
 */
export async function linkDeLeitura(
  bucket: Bucket,
  caminho: string,
  opcoes: { segundos: number; baixarComo?: string | true },
): Promise<string | null> {
  if (!caminhoValido(caminho)) return null;
  const nome =
    opcoes.baixarComo === true ? nomeDoCaminho(caminho) : opcoes.baixarComo;
  const d = noDisco();
  if (!d) return supabase.link(bucket, caminho, opcoes.segundos, nome);
  if (await d.info(bucket, caminho))
    return linkDoDisco(bucket, caminho, opcoes.segundos, nome);
  return comReserva()
    ? supabase.link(bucket, caminho, opcoes.segundos, nome)
    : null;
}

/** Links temporários de vários arquivos (só os que existem entram no mapa). */
export async function linksDeLeitura(
  bucket: Bucket,
  caminhos: string[],
  segundos: number,
): Promise<Map<string, string>> {
  const validos = [...new Set(caminhos.filter((c) => caminhoValido(c)))];
  if (!validos.length) return new Map();
  const d = noDisco();
  if (!d) return supabase.links(bucket, validos, segundos);
  const noDiscoJa = await Promise.all(
    validos.map(async (c) => ((await d.info(bucket, c)) ? c : null)),
  );
  const urls = new Map<string, string>();
  const faltando: string[] = [];
  validos.forEach((c, i) => {
    if (noDiscoJa[i]) urls.set(c, linkDoDisco(bucket, c, segundos));
    else faltando.push(c);
  });
  if (faltando.length && comReserva())
    for (const [c, url] of await supabase.links(bucket, faltando, segundos))
      urls.set(c, url);
  return urls;
}

/**
 * Link para o navegador enviar o arquivo direto (PUT com o arquivo no corpo
 * e o tipo em Content-Type), sem passar pelo limite da Server Action.
 * Depois do envio, quem chamou confere tamanho e tipo com infoDoArquivo e
 * inicioDoArquivo antes de registrar.
 */
export async function prepararEnvio(
  bucket: Bucket,
  caminho: string,
  opcoes: { maxBytes: number; segundos?: number },
): Promise<{ url: string } | { erro: "existe" | "falha" }> {
  if (!caminhoValido(caminho)) return { erro: "falha" };
  const d = noDisco();
  if (!d) return supabase.linkDeEnvio(bucket, caminho);
  if (await d.info(bucket, caminho)) return { erro: "existe" };
  try {
    const token = assinar(
      { op: "enviar", bucket, caminho, maxBytes: opcoes.maxBytes },
      opcoes.segundos ?? 900,
    );
    // Relativo: o envio sai do navegador, na mesma origem da tela.
    return { url: `/api/arquivos/${token}` };
  } catch (e) {
    console.error("link de envio", bucket, e);
    return { erro: "falha" };
  }
}
