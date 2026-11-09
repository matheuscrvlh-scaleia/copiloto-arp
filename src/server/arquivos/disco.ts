import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { caminhoValido, ehBucket } from "./caminho";
import { TIPO_PADRAO } from "./http";

// Arquivos no disco da VPS (volume do Docker). Organização dentro da raiz
// (ARQUIVOS_DIR), a mesma que scripts/migrar-arquivos.mjs grava:
//
//   <raiz>/<bucket>/<caminho>               o arquivo, byte a byte
//   <raiz>/.meta/<bucket>/<caminho>.json    tipo, tamanho, sha256, data
//   <raiz>/.tmp/                            gravação em andamento
//
// Toda gravação vai primeiro para .tmp (mesmo disco) e só aparece no lugar
// final quando está completa e sincronizada com o disco, por link(), que
// falha se o arquivo já existe: nunca sobrescreve e nunca deixa arquivo
// pela metade.

export class ArquivoJaExiste extends Error {
  constructor() {
    super("O arquivo já existe.");
  }
}

export class ArquivoGrandeDemais extends Error {
  constructor(max: number) {
    super(`Arquivo maior que ${max} bytes.`);
  }
}

export type Meta = {
  tipo: string;
  tamanho: number;
  sha256: string;
  criadoEm: string;
  origem?: "supabase";
};

export type InfoDoDisco = { tamanho: number; tipo: string; sha256?: string };

export type Origem =
  | Uint8Array
  | Readable
  | ReadableStream<Uint8Array>
  | WebReadableStream<Uint8Array>;

const naoExiste = (e: unknown) =>
  (e as NodeJS.ErrnoException | undefined)?.code === "ENOENT";

export type Disco = ReturnType<typeof criarDisco>;

export function criarDisco(raiz: string) {
  const base = path.resolve(raiz);

  function resolver(bucket: string, caminho: string) {
    if (!ehBucket(bucket) || !caminhoValido(caminho))
      throw new Error(`Caminho de arquivo inválido: ${bucket}/${caminho}`);
    const partes = caminho.split("/");
    const dados = path.join(base, bucket, ...partes);
    const meta = `${path.join(base, ".meta", bucket, ...partes)}.json`;
    // Segunda conferência, além do caminhoValido: nada sai da raiz.
    if (!dados.startsWith(base + path.sep) || !meta.startsWith(base + path.sep))
      throw new Error(`Caminho de arquivo inválido: ${bucket}/${caminho}`);
    return { dados, meta };
  }

  async function temporario(): Promise<string> {
    const dir = path.join(base, ".tmp");
    await fs.mkdir(dir, { recursive: true });
    return path.join(dir, `${Date.now()}-${randomBytes(8).toString("hex")}`);
  }

  async function escreverMeta(arquivo: string, meta: Meta): Promise<void> {
    await fs.mkdir(path.dirname(arquivo), { recursive: true });
    const tmp = await temporario();
    await fs.writeFile(tmp, JSON.stringify(meta), { flush: true });
    await fs.rename(tmp, arquivo);
  }

  async function lerMeta(arquivo: string): Promise<Partial<Meta>> {
    try {
      return JSON.parse(await fs.readFile(arquivo, "utf8")) as Partial<Meta>;
    } catch {
      return {};
    }
  }

  /** Grava sem sobrescrever (ArquivoJaExiste) e no máximo `maxBytes`. */
  async function gravar(
    bucket: string,
    caminho: string,
    origem: Origem,
    opcoes: { tipo?: string; maxBytes?: number; origem?: "supabase" } = {},
  ): Promise<Meta> {
    const { dados, meta } = resolver(bucket, caminho);
    const tmp = await temporario();
    const hash = createHash("sha256");
    const max = opcoes.maxBytes ?? Number.POSITIVE_INFINITY;
    let tamanho = 0;
    const contar = new Transform({
      transform(parte: Uint8Array, _codificacao, feito) {
        tamanho += parte.length;
        if (tamanho > max) {
          feito(new ArquivoGrandeDemais(max));
          return;
        }
        hash.update(parte);
        feito(null, parte);
      },
    });
    const fonte =
      origem instanceof Uint8Array
        ? Readable.from([origem])
        : origem instanceof Readable
          ? origem
          : Readable.fromWeb(origem as WebReadableStream<Uint8Array>);
    try {
      await pipeline(
        fonte,
        contar,
        createWriteStream(tmp, { flags: "wx", flush: true }),
      );
      await fs.mkdir(path.dirname(dados), { recursive: true });
      await fs.link(tmp, dados);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EEXIST")
        throw new ArquivoJaExiste();
      throw e;
    } finally {
      await fs.rm(tmp, { force: true });
    }
    const m: Meta = {
      tipo: opcoes.tipo || TIPO_PADRAO,
      tamanho,
      sha256: hash.digest("hex"),
      criadoEm: new Date().toISOString(),
      ...(opcoes.origem ? { origem: opcoes.origem } : {}),
    };
    await escreverMeta(meta, m);
    return m;
  }

  async function info(
    bucket: string,
    caminho: string,
  ): Promise<InfoDoDisco | null> {
    const { dados, meta } = resolver(bucket, caminho);
    try {
      const st = await fs.stat(dados);
      if (!st.isFile()) return null;
      const m = await lerMeta(meta);
      return {
        tamanho: st.size,
        tipo: typeof m.tipo === "string" && m.tipo ? m.tipo : TIPO_PADRAO,
        sha256: typeof m.sha256 === "string" ? m.sha256 : undefined,
      };
    } catch (e) {
      if (naoExiste(e)) return null;
      throw e;
    }
  }

  async function ler(
    bucket: string,
    caminho: string,
  ): Promise<Uint8Array | null> {
    const { dados } = resolver(bucket, caminho);
    try {
      return new Uint8Array(await fs.readFile(dados));
    } catch (e) {
      if (naoExiste(e)) return null;
      throw e;
    }
  }

  /** Os primeiros `bytes` do arquivo (conferir o tipo pelo conteúdo). */
  async function inicio(
    bucket: string,
    caminho: string,
    bytes: number,
  ): Promise<Uint8Array | null> {
    const { dados } = resolver(bucket, caminho);
    let arquivo: fs.FileHandle | undefined;
    try {
      arquivo = await fs.open(dados, "r");
      const buf = Buffer.alloc(bytes);
      const { bytesRead } = await arquivo.read(buf, 0, bytes, 0);
      return new Uint8Array(buf.subarray(0, bytesRead));
    } catch (e) {
      if (naoExiste(e)) return null;
      throw e;
    } finally {
      await arquivo?.close();
    }
  }

  /** Leitura em fluxo, inteira ou de um trecho (bytes `inicio` a `fim`, inclusive). */
  function abrir(
    bucket: string,
    caminho: string,
    faixa?: { inicio: number; fim: number },
  ): Readable {
    const { dados } = resolver(bucket, caminho);
    return createReadStream(
      dados,
      faixa ? { start: faixa.inicio, end: faixa.fim } : {},
    );
  }

  /** Apaga o arquivo e os metadados; o que já não existe é ignorado. */
  async function remover(bucket: string, caminhos: string[]): Promise<void> {
    for (const caminho of caminhos) {
      const { dados, meta } = resolver(bucket, caminho);
      await fs.rm(dados, { force: true });
      await fs.rm(meta, { force: true });
    }
  }

  /** Arquivos direto dentro da pasta (sem descer nas subpastas). */
  async function listar(bucket: string, pasta: string): Promise<string[]> {
    const { dados } = resolver(bucket, pasta);
    try {
      const itens = await fs.readdir(dados, { withFileTypes: true });
      return itens
        .filter((i) => i.isFile())
        .map((i) => `${pasta}/${i.name}`)
        .sort();
    } catch (e) {
      if (naoExiste(e)) return [];
      throw e;
    }
  }

  return { gravar, info, ler, inicio, abrir, remover, listar };
}
