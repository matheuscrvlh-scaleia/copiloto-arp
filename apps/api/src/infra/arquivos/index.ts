import { env } from "@/config/env";
import { log } from "@/infra/log";
import { assinar } from "./assinatura";
import { type Bucket, caminhoValido, nomeDoCaminho } from "./caminho";
import { criarDisco, type Disco } from "./disco";

// Ponto único de acesso aos arquivos (fotos, PDFs, planilhas), guardados no
// disco (ARQUIVOS_DIR; na VPS, o volume /dados/arquivos). O resto do sistema
// não fala com o disco direto: chama estas funções, sempre DEPOIS de
// conferir a permissão de quem pede (aqui não há RLS).

export type { Bucket } from "./caminho";
export { ArquivoJaExiste } from "./disco";

/** Caminho da rota que serve os arquivos (modules/arquivos). */
export const ROTA_DOS_ARQUIVOS = "/api/v1/arquivos";

let disco: Disco | undefined;

export function noDisco(): Disco {
  disco ??= criarDisco(env.ARQUIVOS_DIR);
  return disco;
}

/** Grava um arquivo novo; nunca sobrescreve (ArquivoJaExiste). */
export async function gravarArquivo(
  bucket: Bucket,
  caminho: string,
  conteudo: Uint8Array,
  tipo: string,
): Promise<void> {
  if (!caminhoValido(caminho))
    throw new Error(`Caminho de arquivo inválido: ${caminho}`);
  await noDisco().gravar(bucket, caminho, conteudo, { tipo });
}

export async function lerArquivo(
  bucket: Bucket,
  caminho: string,
): Promise<Uint8Array | null> {
  if (!caminhoValido(caminho)) return null;
  return noDisco().ler(bucket, caminho);
}

/** Os primeiros bytes (conferir o tipo pelo conteúdo sem ler tudo). */
export async function inicioDoArquivo(
  bucket: Bucket,
  caminho: string,
  bytes: number,
): Promise<Uint8Array | null> {
  if (!caminhoValido(caminho)) return null;
  return noDisco().inicio(bucket, caminho, bytes);
}

export async function infoDoArquivo(
  bucket: Bucket,
  caminho: string,
): Promise<{ tamanho: number; tipo: string } | null> {
  if (!caminhoValido(caminho)) return null;
  const info = await noDisco().info(bucket, caminho);
  return info ? { tamanho: info.tamanho, tipo: info.tipo } : null;
}

/** Apaga os arquivos; o que já não existe é ignorado. false se algo falhou. */
export async function removerArquivos(
  bucket: Bucket,
  caminhos: string[],
): Promise<boolean> {
  const validos = caminhos.filter((c) => caminhoValido(c));
  if (!validos.length) return true;
  try {
    await noDisco().remover(bucket, validos);
    return true;
  } catch (err) {
    log.error({ bucket, err }, "remover arquivos do disco");
    return false;
  }
}

/** Caminhos dos arquivos direto dentro da pasta. */
export async function listarArquivos(
  bucket: Bucket,
  pasta: string,
): Promise<string[]> {
  if (!caminhoValido(pasta)) return [];
  return noDisco().listar(bucket, pasta);
}

function linkAssinado(
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
  // Absoluto: o link também vai para fora da tela (WhatsApp, e-mail).
  return `${env.SITE_URL}${ROTA_DOS_ARQUIVOS}/${token}`;
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
  if (!(await noDisco().info(bucket, caminho))) return null;
  const nome =
    opcoes.baixarComo === true ? nomeDoCaminho(caminho) : opcoes.baixarComo;
  return linkAssinado(bucket, caminho, opcoes.segundos, nome);
}

/** Links temporários de vários arquivos (só os que existem entram no mapa). */
export async function linksDeLeitura(
  bucket: Bucket,
  caminhos: string[],
  segundos: number,
): Promise<Map<string, string>> {
  const validos = [...new Set(caminhos.filter((c) => caminhoValido(c)))];
  const d = noDisco();
  const existem = await Promise.all(
    validos.map(async (c) => ((await d.info(bucket, c)) ? c : null)),
  );
  return new Map(
    existem
      .filter((c) => c !== null)
      .map((c) => [c, linkAssinado(bucket, c, segundos)]),
  );
}

/**
 * Link para o navegador enviar o arquivo direto (PUT com o arquivo no corpo
 * e o tipo em Content-Type; `enviarParaLink` de @arp/shared/enviar-arquivo).
 * Depois do envio, quem chamou confere tamanho e tipo com infoDoArquivo e
 * inicioDoArquivo antes de registrar.
 */
export async function prepararEnvio(
  bucket: Bucket,
  caminho: string,
  opcoes: { maxBytes: number; segundos?: number },
): Promise<{ url: string } | { erro: "existe" | "falha" }> {
  if (!caminhoValido(caminho)) return { erro: "falha" };
  try {
    if (await noDisco().info(bucket, caminho)) return { erro: "existe" };
    const token = assinar(
      { op: "enviar", bucket, caminho, maxBytes: opcoes.maxBytes },
      opcoes.segundos ?? 900,
    );
    // Relativo: o envio sai do navegador, na mesma origem da tela.
    return { url: `${ROTA_DOS_ARQUIVOS}/${token}` };
  } catch (err) {
    log.error({ bucket, err }, "link de envio");
    return { erro: "falha" };
  }
}
