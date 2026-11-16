import { PERMISSOES } from "@arp/shared/permissions";
import type { FastifyInstance } from "fastify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarApp } from "@/app";
import { MODULOS } from "@/modules";

// Toda rota declara quem pode chamar. Este teste percorre as rotas
// registradas de verdade (todos os módulos) e falha se alguma esqueceu.
// Não precisa de banco: a recusa acontece antes de qualquer consulta.

const esquecida: FastifyPluginAsyncZod = async (app) => {
  app.get("/sem-declaracao", async () => ({ vazou: true }));
  app.post("/sem-declaracao", async () => ({ vazou: true }));
};

describe("declaração de acesso das rotas", () => {
  let app: FastifyInstance;
  let comEsquecida: FastifyInstance;

  beforeAll(async () => {
    app = await criarApp();
    comEsquecida = await criarApp([
      ...MODULOS,
      { prefixo: "/teste", plugin: esquecida },
    ]);
  });
  afterAll(async () => {
    await app.close();
    await comEsquecida.close();
  });

  it("toda rota registrada declara `acesso` ou `permissao`", () => {
    expect(app.rotas.length).toBeGreaterThan(5);
    const semDeclarar = app.rotas
      .filter((r) => !r.acesso && !r.permissao)
      .map((r) => `${r.metodo} ${r.url}`);
    expect(semDeclarar).toEqual([]);
  });

  it("toda permissão declarada existe em @arp/shared/permissions", () => {
    const desconhecidas = app.rotas
      .filter((r) => r.permissao && !(r.permissao in PERMISSOES))
      .map((r) => `${r.metodo} ${r.url}: ${r.permissao}`);
    expect(desconhecidas).toEqual([]);
  });

  it("o teste enxerga uma rota que esqueceu de declarar", () => {
    expect(
      comEsquecida.rotas.filter((r) => !r.acesso && !r.permissao).length,
    ).toBeGreaterThan(0);
  });

  it("rota sem declaração é negada, nunca servida", async () => {
    const origem = new URL(process.env.SITE_URL ?? "").origin;
    const leitura = await comEsquecida.inject({
      method: "GET",
      url: "/api/v1/teste/sem-declaracao",
    });
    const gravacao = await comEsquecida.inject({
      method: "POST",
      url: "/api/v1/teste/sem-declaracao",
      headers: { origin: origem, "x-arp": "1" },
    });
    for (const r of [leitura, gravacao]) {
      expect(r.statusCode).toBe(403);
      expect(r.json().erro.codigo).toBe("sem_permissao");
      expect(r.body).not.toContain("vazou");
    }
  });

  it("rota que não existe responde 404 no formato de erro", async () => {
    const r = await app.inject({ method: "GET", url: "/api/v1/nao-existe" });
    expect(r.statusCode).toBe(404);
    expect(r.json()).toEqual({
      erro: { codigo: "nao_encontrado", mensagem: "Rota não encontrada." },
    });
  });

  it("as respostas saem com os cabeçalhos de segurança", async () => {
    const r = await app.inject({ method: "GET", url: "/api/v1/nao-existe" });
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
    expect(r.headers["content-security-policy"]).toContain(
      "default-src 'none'",
    );
    expect(r.headers).not.toHaveProperty("x-powered-by");
  });
});
