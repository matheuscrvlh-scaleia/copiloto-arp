// Leitor mínimo de ZIP para a importação do sistema atual (spec 4.14), sem
// dependência nova: lê o diretório central no fim do arquivo e descompacta
// só a entrada pedida (deflate pelo DecompressionStream do próprio runtime).
// Lê aos pedaços por uma FonteDeBytes: no servidor, pedidos com Range ao
// arquivo guardado no bucket, sem trazer um backup de gigas para a memória.
// Aceita ZIP64 (backup acima de 4 GB). Não aceita ZIP com senha nem outros
// métodos de compressão: nesses casos, a mensagem diz o que fazer.

export class ErroZip extends Error {}

/** Pedaços de um arquivo: `ler(inicio, fim)` devolve os bytes [inicio, fim). */
export interface FonteDeBytes {
  tamanho: number;
  ler(inicio: number, fim: number): Promise<Uint8Array>;
}

export function fonteDeMemoria(bytes: Uint8Array): FonteDeBytes {
  return {
    tamanho: bytes.length,
    ler: async (inicio, fim) =>
      bytes.subarray(inicio, Math.min(fim, bytes.length)),
  };
}

export interface EntradaZip {
  /** Caminho dentro do ZIP, com "/" (ex.: "fotos/123_antes.jpg"). */
  nome: string;
  tamanho: number;
  comprimido: number;
  metodo: number;
  crc: number;
  /** Onde começa o cabeçalho local da entrada. */
  deslocamento: number;
}

const ASSINATURA_FIM = 0x06054b50;
const ASSINATURA_FIM64 = 0x06064b50;
const LOCALIZADOR64 = 0x07064b50;
const ASSINATURA_CENTRAL = 0x02014b50;
const ASSINATURA_LOCAL = 0x04034b50;
const MAX16 = 0xffff;
const MAX32 = 0xffffffff;

const TABELA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

/** CRC-32 (o do ZIP e do PNG). */
export function crc32(bytes: Uint8Array, anterior = 0): number {
  let c = (anterior ^ 0xffffffff) >>> 0;
  for (const b of bytes) c = (TABELA_CRC[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const visao = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.length);

function u64(v: DataView, pos: number): number {
  const n = v.getBigUint64(pos, true);
  if (n > BigInt(Number.MAX_SAFE_INTEGER))
    throw new ErroZip("ZIP grande demais para ler.");
  return Number(n);
}

/** Nome em UTF-8 (marcado no ZIP) ou na página de código antiga do Windows. */
function nomeDaEntrada(bytes: Uint8Array, utf8: boolean): string {
  if (!utf8) {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return new TextDecoder("windows-1252").decode(bytes);
    }
  }
  return new TextDecoder().decode(bytes);
}

/** Diretório central: todas as entradas (pastas ficam de fora). */
export async function lerZip(fonte: FonteDeBytes): Promise<EntradaZip[]> {
  if (fonte.tamanho < 22) throw new ErroZip("O arquivo não é um ZIP.");
  // O fim do diretório fica nos últimos 22 bytes + até 64 KB de comentário.
  const inicioCauda = Math.max(0, fonte.tamanho - (22 + MAX16 + 20));
  const cauda = await fonte.ler(inicioCauda, fonte.tamanho);
  const vc = visao(cauda);
  let fim = -1;
  for (let i = cauda.length - 22; i >= 0; i--)
    if (vc.getUint32(i, true) === ASSINATURA_FIM) {
      fim = i;
      break;
    }
  if (fim < 0)
    throw new ErroZip("O arquivo não é um ZIP (ou está incompleto).");

  let total = vc.getUint16(fim + 10, true);
  let tamanhoCentral = vc.getUint32(fim + 12, true);
  let inicioCentral = vc.getUint32(fim + 16, true);
  if (total === MAX16 || tamanhoCentral === MAX32 || inicioCentral === MAX32) {
    const loc = fim - 20;
    if (loc < 0 || vc.getUint32(loc, true) !== LOCALIZADOR64)
      throw new ErroZip("ZIP64 sem o localizador: o arquivo está corrompido.");
    const pos64 = u64(vc, loc + 8);
    const reg = visao(await fonte.ler(pos64, pos64 + 56));
    if (reg.getUint32(0, true) !== ASSINATURA_FIM64)
      throw new ErroZip("ZIP64 corrompido.");
    total = u64(reg, 32);
    tamanhoCentral = u64(reg, 40);
    inicioCentral = u64(reg, 48);
  }

  const central = await fonte.ler(
    inicioCentral,
    inicioCentral + tamanhoCentral,
  );
  const v = visao(central);
  const entradas: EntradaZip[] = [];
  let pos = 0;
  for (let n = 0; n < total; n++) {
    if (
      pos + 46 > central.length ||
      v.getUint32(pos, true) !== ASSINATURA_CENTRAL
    )
      throw new ErroZip("Diretório do ZIP corrompido.");
    const flags = v.getUint16(pos + 8, true);
    const metodo = v.getUint16(pos + 10, true);
    const crc = v.getUint32(pos + 16, true);
    let comprimido = v.getUint32(pos + 20, true);
    let tamanho = v.getUint32(pos + 24, true);
    const tamNome = v.getUint16(pos + 28, true);
    const tamExtra = v.getUint16(pos + 30, true);
    const tamComentario = v.getUint16(pos + 32, true);
    let deslocamento = v.getUint32(pos + 42, true);
    const nome = nomeDaEntrada(
      central.subarray(pos + 46, pos + 46 + tamNome),
      (flags & 0x800) !== 0,
    ).replace(/\\/g, "/");

    // ZIP64: os campos cheios (0xFFFFFFFF) vêm no extra 0x0001, em ordem.
    let e = pos + 46 + tamNome;
    const fimExtra = e + tamExtra;
    while (e + 4 <= fimExtra) {
      const id = v.getUint16(e, true);
      const tam = v.getUint16(e + 2, true);
      if (id === 0x0001) {
        let p = e + 4;
        if (tamanho === MAX32) {
          tamanho = u64(v, p);
          p += 8;
        }
        if (comprimido === MAX32) {
          comprimido = u64(v, p);
          p += 8;
        }
        if (deslocamento === MAX32) deslocamento = u64(v, p);
      }
      e += 4 + tam;
    }

    if ((flags & 0x1) !== 0)
      throw new ErroZip(
        `"${nome}" está protegido por senha. Gere o ZIP sem senha.`,
      );
    if (!nome.endsWith("/"))
      entradas.push({ nome, tamanho, comprimido, metodo, crc, deslocamento });
    pos = fimExtra + tamComentario;
  }
  return entradas;
}

async function inflar(bytes: Uint8Array): Promise<Uint8Array> {
  const fluxo = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

/** Conteúdo de uma entrada, conferido pelo CRC. */
export async function extrair(
  fonte: FonteDeBytes,
  e: EntradaZip,
): Promise<Uint8Array> {
  const cabecalho = visao(await fonte.ler(e.deslocamento, e.deslocamento + 30));
  if (cabecalho.getUint32(0, true) !== ASSINATURA_LOCAL)
    throw new ErroZip(`"${e.nome}" está corrompido no ZIP.`);
  const inicio =
    e.deslocamento +
    30 +
    cabecalho.getUint16(26, true) +
    cabecalho.getUint16(28, true);
  const dados = await fonte.ler(inicio, inicio + e.comprimido);
  let conteudo: Uint8Array;
  if (e.metodo === 0) conteudo = dados;
  else if (e.metodo === 8) conteudo = await inflar(dados);
  else
    throw new ErroZip(
      `"${e.nome}" usa uma compressão que o importador não lê. Gere o ZIP no formato comum (deflate).`,
    );
  if (conteudo.length !== e.tamanho || crc32(conteudo) !== e.crc)
    throw new ErroZip(`"${e.nome}" veio corrompido no ZIP.`);
  return conteudo;
}

/** O arquivo começa como um ZIP? (assinatura do primeiro cabeçalho) */
export function pareceZip(inicio: Uint8Array): boolean {
  return (
    inicio.length >= 4 &&
    inicio[0] === 0x50 &&
    inicio[1] === 0x4b &&
    (inicio[2] === 3 || inicio[2] === 5) &&
    (inicio[3] === 4 || inicio[3] === 6)
  );
}
