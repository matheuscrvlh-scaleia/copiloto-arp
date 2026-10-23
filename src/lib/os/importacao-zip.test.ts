import { describe, expect, it } from "vitest";
import {
  crc32,
  ErroZip,
  extrair,
  type FonteDeBytes,
  fonteDeMemoria,
  lerZip,
  pareceZip,
} from "./importacao-zip";

// Escritor de ZIP só para o teste (stored ou deflate; ZIP64 opcional).
async function deflateRaw(b: Uint8Array): Promise<Uint8Array> {
  const f = new Blob([b as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(f).arrayBuffer());
}

async function montarZip(
  arquivos: { nome: string; conteudo: Uint8Array; comprimir?: boolean }[],
  opcoes: { zip64?: boolean; comentario?: string; senha?: boolean } = {},
): Promise<Uint8Array> {
  const partes: Uint8Array[] = [];
  const centrais: Uint8Array[] = [];
  let pos = 0;
  for (const a of arquivos) {
    const nome = new TextEncoder().encode(a.nome);
    const dados = a.comprimir ? await deflateRaw(a.conteudo) : a.conteudo;
    const crc = crc32(a.conteudo);
    const local = new Uint8Array(30 + nome.length);
    const vl = new DataView(local.buffer);
    vl.setUint32(0, 0x04034b50, true);
    vl.setUint16(6, (opcoes.senha ? 1 : 0) | 0x800, true);
    vl.setUint16(8, a.comprimir ? 8 : 0, true);
    vl.setUint32(14, crc, true);
    vl.setUint32(18, dados.length, true);
    vl.setUint32(22, a.conteudo.length, true);
    vl.setUint16(26, nome.length, true);
    local.set(nome, 30);
    const extra = opcoes.zip64 ? new Uint8Array(28) : new Uint8Array();
    if (opcoes.zip64) {
      const ve = new DataView(extra.buffer);
      ve.setUint16(0, 1, true);
      ve.setUint16(2, 24, true);
      ve.setBigUint64(4, BigInt(a.conteudo.length), true);
      ve.setBigUint64(12, BigInt(dados.length), true);
      ve.setBigUint64(20, BigInt(pos), true);
    }
    const central = new Uint8Array(46 + nome.length + extra.length);
    const vc = new DataView(central.buffer);
    vc.setUint32(0, 0x02014b50, true);
    vc.setUint16(8, (opcoes.senha ? 1 : 0) | 0x800, true);
    vc.setUint16(10, a.comprimir ? 8 : 0, true);
    vc.setUint32(16, crc, true);
    vc.setUint32(20, opcoes.zip64 ? 0xffffffff : dados.length, true);
    vc.setUint32(24, opcoes.zip64 ? 0xffffffff : a.conteudo.length, true);
    vc.setUint16(28, nome.length, true);
    vc.setUint16(30, extra.length, true);
    vc.setUint32(42, opcoes.zip64 ? 0xffffffff : pos, true);
    central.set(nome, 46);
    central.set(extra, 46 + nome.length);
    partes.push(local, dados);
    centrais.push(central);
    pos += local.length + dados.length;
  }
  const inicioCentral = pos;
  const tamanhoCentral = centrais.reduce((t, c) => t + c.length, 0);
  partes.push(...centrais);
  pos += tamanhoCentral;
  if (opcoes.zip64) {
    const r = new Uint8Array(56);
    const vr = new DataView(r.buffer);
    vr.setUint32(0, 0x06064b50, true);
    vr.setBigUint64(32, BigInt(arquivos.length), true);
    vr.setBigUint64(40, BigInt(tamanhoCentral), true);
    vr.setBigUint64(48, BigInt(inicioCentral), true);
    const l = new Uint8Array(20);
    const vl = new DataView(l.buffer);
    vl.setUint32(0, 0x07064b50, true);
    vl.setBigUint64(8, BigInt(pos), true);
    partes.push(r, l);
  }
  const comentario = new TextEncoder().encode(opcoes.comentario ?? "");
  const fim = new Uint8Array(22 + comentario.length);
  const vf = new DataView(fim.buffer);
  vf.setUint32(0, 0x06054b50, true);
  vf.setUint16(10, opcoes.zip64 ? 0xffff : arquivos.length, true);
  vf.setUint32(12, opcoes.zip64 ? 0xffffffff : tamanhoCentral, true);
  vf.setUint32(16, opcoes.zip64 ? 0xffffffff : inicioCentral, true);
  vf.setUint16(20, comentario.length, true);
  fim.set(comentario, 22);
  partes.push(fim);
  const zip = new Uint8Array(partes.reduce((t, p) => t + p.length, 0));
  let p = 0;
  for (const parte of partes) {
    zip.set(parte, p);
    p += parte.length;
  }
  return zip;
}

const texto = (s: string) => new TextEncoder().encode(s);
const ler = (b: Uint8Array) => new TextDecoder().decode(b);

describe("leitor de ZIP", () => {
  it("lista e extrai entradas guardadas e comprimidas", async () => {
    const json = JSON.stringify({ itens: Array(200).fill("repetido") });
    const zip = await montarZip(
      [
        { nome: "manifesto.json", conteudo: texto('{"a":1}') },
        { nome: "dados/os.json", conteudo: texto(json), comprimir: true },
        { nome: "fotos/ação 1.jpg", conteudo: new Uint8Array([1, 2, 3]) },
      ],
      { comentario: "Backup de teste" },
    );
    expect(pareceZip(zip)).toBe(true);
    const fonte = fonteDeMemoria(zip);
    const entradas = await lerZip(fonte);
    expect(entradas.map((e) => e.nome)).toEqual([
      "manifesto.json",
      "dados/os.json",
      "fotos/ação 1.jpg",
    ]);
    const [a, b, c] = entradas;
    if (!a || !b || !c) throw new Error("faltou entrada");
    expect(ler(await extrair(fonte, a))).toBe('{"a":1}');
    expect(b.comprimido).toBeLessThan(b.tamanho);
    expect(ler(await extrair(fonte, b))).toBe(json);
    expect([...(await extrair(fonte, c))]).toEqual([1, 2, 3]);
  });

  it("lê ZIP64", async () => {
    const zip = await montarZip(
      [{ nome: "grande.json", conteudo: texto("[1,2,3]"), comprimir: true }],
      { zip64: true },
    );
    const fonte = fonteDeMemoria(zip);
    const [e] = await lerZip(fonte);
    if (!e) throw new Error("sem entrada");
    expect(e.tamanho).toBe(7);
    expect(ler(await extrair(fonte, e))).toBe("[1,2,3]");
  });

  it("lê aos pedaços (só a cauda e a entrada pedida)", async () => {
    const grande = new Uint8Array(300_000).fill(7);
    const zip = await montarZip([
      { nome: "fotos/a.jpg", conteudo: grande },
      { nome: "manifesto.json", conteudo: texto("{}") },
    ]);
    let lidos = 0;
    const memoria = fonteDeMemoria(zip);
    const fonte: FonteDeBytes = {
      tamanho: zip.length,
      ler: async (i, f) => {
        lidos += f - i;
        return memoria.ler(i, f);
      },
    };
    const entradas = await lerZip(fonte);
    const manifesto = entradas.find((e) => e.nome === "manifesto.json");
    if (!manifesto) throw new Error("sem manifesto");
    expect(ler(await extrair(fonte, manifesto))).toBe("{}");
    expect(lidos).toBeLessThan(100_000);
  });

  it("recusa o que não é ZIP, ZIP com senha e conteúdo corrompido", async () => {
    await expect(
      lerZip(fonteDeMemoria(texto("não sou zip, só texto"))),
    ).rejects.toThrow(ErroZip);
    const comSenha = await montarZip(
      [{ nome: "a.txt", conteudo: texto("x") }],
      { senha: true },
    );
    await expect(lerZip(fonteDeMemoria(comSenha))).rejects.toThrow(/senha/);
    const zip = await montarZip([{ nome: "a.txt", conteudo: texto("abc") }]);
    const fonte = fonteDeMemoria(zip);
    const [e] = await lerZip(fonte);
    if (!e) throw new Error("sem entrada");
    zip[30 + 5] = 0x5a;
    await expect(extrair(fonte, e)).rejects.toThrow(/corrompido/);
  });
});
