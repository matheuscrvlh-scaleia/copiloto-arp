import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { assinar, conferir } = await import("./assinatura");
const { caminhoValido } = await import("./caminho");
const { ArquivoGrandeDemais, ArquivoJaExiste, criarDisco } = await import(
  "./disco"
);
const { disposicao, lerFaixa, podeMostrar, tipoLimpo } = await import("./http");

describe("caminhoValido", () => {
  it("aceita os caminhos que o sistema gera", () => {
    for (const c of [
      "ordens/3f1c/ab12cd-foto.jpg",
      "folha/0c7e/Extrato_Mensal.pdf",
      "importacoes/censo/1b2c/planilha.xlsx",
      "1b2c3d4e-0000-0000-0000-000000000000/9f8e.pdf",
    ])
      expect(caminhoValido(c)).toBe(true);
  });

  it("recusa o que escaparia da pasta ou bate nos metadados", () => {
    for (const c of [
      "",
      "/etc/passwd",
      "../fora",
      "a/../../fora",
      "a/./b",
      "a//b",
      ".meta/os/x.json",
      "a/.tmp",
      "a\\b",
      "a/b\u0000c",
      "x".repeat(1025),
    ])
      expect(caminhoValido(c)).toBe(false);
  });
});

describe("assinatura dos links", () => {
  beforeAll(() => {
    process.env.ARQUIVOS_CHAVE = randomBytes(32).toString("base64");
  });

  const leitura = {
    op: "ler",
    bucket: "os",
    caminho: "ordens/1/a.jpg",
  } as const;

  it("confere o que assinou", () => {
    const p = conferir(assinar(leitura, 60));
    expect(p).toMatchObject(leitura);
  });

  it("recusa token alterado", () => {
    const token = assinar(leitura, 60);
    const [corpo, mac] = token.split(".") as [string, string];
    const outro = Buffer.from(
      JSON.stringify({ ...leitura, caminho: "ordens/2/b.jpg", exp: 9e9 }),
    ).toString("base64url");
    expect(conferir(`${outro}.${mac}`)).toBeNull();
    expect(conferir(`${corpo}.${mac.slice(1)}x`)).toBeNull();
    expect(conferir(corpo)).toBeNull();
  });

  it("recusa token vencido", () => {
    const agora = Date.now();
    const token = assinar(leitura, 60, agora);
    expect(conferir(token, agora + 59_000)).not.toBeNull();
    expect(conferir(token, agora + 61_000)).toBeNull();
  });

  it("recusa token de outra chave", () => {
    const token = assinar(leitura, 60);
    process.env.ARQUIVOS_CHAVE = randomBytes(32).toString("base64");
    expect(conferir(token)).toBeNull();
  });

  it("recusa bucket ou caminho fora da regra, mesmo assinado", () => {
    expect(conferir(assinar({ ...leitura, bucket: "outro" }, 60))).toBeNull();
    expect(
      conferir(assinar({ ...leitura, caminho: "../segredo" }, 60)),
    ).toBeNull();
  });
});

describe("regras HTTP", () => {
  it("lê um trecho só do Range", () => {
    expect(lerFaixa(null, 100)).toBeNull();
    expect(lerFaixa("bytes=0-9", 100)).toEqual({ inicio: 0, fim: 9 });
    expect(lerFaixa("bytes=90-", 100)).toEqual({ inicio: 90, fim: 99 });
    expect(lerFaixa("bytes=-10", 100)).toEqual({ inicio: 90, fim: 99 });
    expect(lerFaixa("bytes=50-500", 100)).toEqual({ inicio: 50, fim: 99 });
    expect(lerFaixa("bytes=100-", 100)).toBe("invalida");
    expect(lerFaixa("bytes=0-1,5-6", 100)).toBeNull();
  });

  it("só mostra na aba os tipos seguros", () => {
    expect(podeMostrar(tipoLimpo("image/jpeg"))).toBe(true);
    expect(podeMostrar(tipoLimpo("application/pdf"))).toBe(true);
    expect(podeMostrar(tipoLimpo("image/svg+xml"))).toBe(false);
    expect(podeMostrar(tipoLimpo("text/html; charset=utf-8"))).toBe(false);
    expect(tipoLimpo("lixo")).toBe("application/octet-stream");
  });

  it("nome do download em ASCII e UTF-8", () => {
    expect(disposicao("attachment", 'Contrato "São" 100%.pdf')).toBe(
      `attachment; filename="Contrato _S_o_ 100_.pdf"; filename*=UTF-8''Contrato%20%22S%C3%A3o%22%20100%25.pdf`,
    );
  });
});

describe("disco", () => {
  let raiz: string;
  let disco: ReturnType<typeof criarDisco>;

  beforeAll(async () => {
    raiz = await fs.mkdtemp(path.join(os.tmpdir(), "arquivos-"));
    disco = criarDisco(raiz);
  });

  afterAll(async () => {
    await fs.rm(raiz, { recursive: true, force: true });
  });

  it("grava, lê, informa e lista", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.7 conteúdo");
    const meta = await disco.gravar("comercial", "kit/1/a.pdf", bytes, {
      tipo: "application/pdf",
    });
    expect(meta.tamanho).toBe(bytes.length);
    expect(await disco.ler("comercial", "kit/1/a.pdf")).toEqual(bytes);
    expect(await disco.info("comercial", "kit/1/a.pdf")).toMatchObject({
      tamanho: bytes.length,
      tipo: "application/pdf",
    });
    expect(await disco.inicio("comercial", "kit/1/a.pdf", 4)).toEqual(
      bytes.slice(0, 4),
    );
    expect(await disco.listar("comercial", "kit/1")).toEqual(["kit/1/a.pdf"]);
  });

  it("nunca sobrescreve", async () => {
    const um = new Uint8Array([1]);
    await disco.gravar("os", "ordens/1/x.bin", um);
    await expect(
      disco.gravar("os", "ordens/1/x.bin", new Uint8Array([2])),
    ).rejects.toBeInstanceOf(ArquivoJaExiste);
    expect(await disco.ler("os", "ordens/1/x.bin")).toEqual(um);
  });

  it("para no limite de tamanho e não deixa sobra", async () => {
    await expect(
      disco.gravar("os", "ordens/2/grande.bin", new Uint8Array(11), {
        maxBytes: 10,
      }),
    ).rejects.toBeInstanceOf(ArquivoGrandeDemais);
    expect(await disco.info("os", "ordens/2/grande.bin")).toBeNull();
    expect(await fs.readdir(path.join(raiz, ".tmp"))).toEqual([]);
  });

  it("remove o arquivo e os metadados; o que não existe é ignorado", async () => {
    await disco.gravar("marketing", "marca/l/1-x.png", new Uint8Array([1]));
    await disco.remover("marketing", ["marca/l/1-x.png", "marca/l/nada.png"]);
    expect(await disco.info("marketing", "marca/l/1-x.png")).toBeNull();
    expect(await disco.ler("marketing", "marca/l/1-x.png")).toBeNull();
  });

  it("recusa caminho que sairia da raiz", async () => {
    await expect(disco.ler("os", "../../fora")).rejects.toThrow(/inválido/);
    await expect(disco.ler("nao-existe", "a")).rejects.toThrow(/inválido/);
  });
});
