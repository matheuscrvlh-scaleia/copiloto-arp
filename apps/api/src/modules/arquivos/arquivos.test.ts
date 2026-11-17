import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarApp } from "@/app";
import { env } from "@/config/env";
import {
  gravarArquivo,
  infoDoArquivo,
  linkDeLeitura,
  prepararEnvio,
} from "@/infra/arquivos";

// A rota dos arquivos por link assinado, de ponta a ponta, numa pasta
// temporária (testes/preparar.ts aponta ARQUIVOS_DIR para lá). Sem banco.

const caminhoDe = (link: string | null) =>
  new URL(link ?? "", env.SITE_URL).pathname;

describe("/api/v1/arquivos/:token", () => {
  let app: FastifyInstance;
  const pasta = `teste/${randomUUID()}`;

  beforeAll(async () => {
    app = await criarApp();
  });
  afterAll(async () => {
    await app.close();
    await fs.rm(env.ARQUIVOS_DIR, { recursive: true, force: true });
  });

  it("recebe o envio direto do navegador (PUT, sem X-ARP) e não sobrescreve", async () => {
    const caminho = `${pasta}/foto.png`;
    const preparo = await prepararEnvio("os", caminho, { maxBytes: 100 });
    if (!("url" in preparo)) throw new Error("não preparou o envio");
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    const enviar = () =>
      app.inject({
        method: "PUT",
        url: preparo.url,
        headers: { "content-type": "image/png", "x-upsert": "false" },
        payload: bytes,
      });
    const r = await enviar();
    expect(r.statusCode).toBe(200);
    expect(await infoDoArquivo("os", caminho)).toEqual({
      tamanho: bytes.length,
      tipo: "image/png",
    });
    const repetido = await enviar();
    expect(repetido.statusCode).toBe(409);
    expect(repetido.json().erro.codigo).toBe("conflito");
  });

  it("envio de JSON também chega como arquivo (não é interpretado)", async () => {
    const caminho = `${pasta}/dados.json`;
    const preparo = await prepararEnvio("importacoes", caminho, {
      maxBytes: 100,
    });
    if (!("url" in preparo)) throw new Error("não preparou o envio");
    const r = await app.inject({
      method: "PUT",
      url: preparo.url,
      headers: { "content-type": "application/json" },
      payload: '{"a":1}',
    });
    expect(r.statusCode).toBe(200);
    expect(await infoDoArquivo("importacoes", caminho)).toMatchObject({
      tamanho: 7,
    });
  });

  it("recusa arquivo maior que o combinado e não deixa sobra", async () => {
    const caminho = `${pasta}/grande.bin`;
    const preparo = await prepararEnvio("os", caminho, { maxBytes: 10 });
    if (!("url" in preparo)) throw new Error("não preparou o envio");
    const r = await app.inject({
      method: "PUT",
      url: preparo.url,
      headers: { "content-type": "application/octet-stream" },
      payload: Buffer.alloc(11),
    });
    expect(r.statusCode).toBe(413);
    expect(await infoDoArquivo("os", caminho)).toBeNull();
  });

  it("entrega o arquivo, inteiro ou em trecho, com os cabeçalhos certos", async () => {
    const caminho = `${pasta}/laudo.pdf`;
    const bytes = Buffer.from("%PDF-1.7 conteúdo do laudo");
    await gravarArquivo("comercial", caminho, bytes, "application/pdf");
    const url = caminhoDe(
      await linkDeLeitura("comercial", caminho, { segundos: 60 }),
    );

    const r = await app.inject({ method: "GET", url });
    expect(r.statusCode).toBe(200);
    expect(r.rawPayload).toEqual(bytes);
    expect(r.headers["content-type"]).toBe("application/pdf");
    expect(r.headers["content-disposition"]).toBe("inline");
    expect(r.headers["cache-control"]).toMatch(/^private, max-age=\d+$/);
    // PDF: sem CSP (o leitor do navegador não abre com sandbox).
    expect(r.headers).not.toHaveProperty("content-security-policy");

    const trecho = await app.inject({
      method: "GET",
      url,
      headers: { range: "bytes=0-3" },
    });
    expect(trecho.statusCode).toBe(206);
    expect(trecho.body).toBe("%PDF");
    expect(trecho.headers["content-range"]).toBe(`bytes 0-3/${bytes.length}`);

    const fora = await app.inject({
      method: "GET",
      url,
      headers: { range: "bytes=999-" },
    });
    expect(fora.statusCode).toBe(416);
  });

  it("link já enviado pelo sistema antigo (/api/arquivos/:token) continua abrindo", async () => {
    const caminho = `${pasta}/laudo-antigo.pdf`;
    const bytes = Buffer.from("%PDF-1.7 laudo enviado antes da troca");
    await gravarArquivo("os", caminho, bytes, "application/pdf");
    const novo = caminhoDe(
      await linkDeLeitura("os", caminho, { segundos: 60 }),
    );
    expect(novo.startsWith("/api/v1/arquivos/")).toBe(true);
    const antigo = novo.replace("/api/v1/arquivos/", "/api/arquivos/");

    const r = await app.inject({ method: "GET", url: antigo });
    expect(r.statusCode).toBe(200);
    expect(r.rawPayload).toEqual(bytes);
    expect(r.headers["content-type"]).toBe("application/pdf");
    expect(r.headers["content-disposition"]).toBe("inline");

    // Token inválido: a mesma recusa do endereço novo.
    const ruim = await app.inject({ method: "GET", url: `${antigo}x` });
    const ruimNovo = await app.inject({ method: "GET", url: `${novo}x` });
    expect(ruim.statusCode).toBe(ruimNovo.statusCode);
    expect(ruim.statusCode).toBeGreaterThanOrEqual(400);

    // O endereço antigo só lê: o envio (PUT) continua só em /api/v1.
    const envio = await app.inject({ method: "PUT", url: antigo });
    expect(envio.statusCode).toBe(404);
  });

  it("o que poderia rodar script sempre baixa, isolado", async () => {
    const caminho = `${pasta}/desenho.svg`;
    await gravarArquivo(
      "marketing",
      caminho,
      Buffer.from("<svg onload=alert(1) xmlns='http://www.w3.org/2000/svg'/>"),
      "image/svg+xml",
    );
    const r = await app.inject({
      method: "GET",
      url: caminhoDe(
        await linkDeLeitura("marketing", caminho, { segundos: 60 }),
      ),
    });
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-disposition"]).toMatch(/^attachment; /);
    expect(r.headers["content-security-policy"]).toContain("sandbox");
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("link adulterado, de outra operação ou de arquivo que sumiu não abre", async () => {
    const caminho = `${pasta}/x.txt`;
    await gravarArquivo("os", caminho, Buffer.from("oi"), "text/plain");
    const url = caminhoDe(await linkDeLeitura("os", caminho, { segundos: 60 }));

    const adulterado = await app.inject({ method: "GET", url: `${url}x` });
    expect(adulterado.statusCode).toBe(403);
    expect(adulterado.json().erro.mensagem).toBe("Link inválido ou vencido.");
    // O link de leitura não serve para enviar.
    const troca = await app.inject({ method: "PUT", url, payload: "novo" });
    expect(troca.statusCode).toBe(403);

    expect(
      await linkDeLeitura("os", `${pasta}/nao-existe.txt`, { segundos: 60 }),
    ).toBeNull();
  });
});
