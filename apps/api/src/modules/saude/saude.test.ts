import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { criarApp } from "@/app";
import { banco } from "@/infra/banco";
import { descreverComBanco } from "@/testes/apoio";

// Só o que o teste usa (o mesmo plugin e o mesmo prefixo de EXTERNOS): um
// módulo de outro pedaço ainda incompleto não derruba este arquivo.
vi.mock("@/modules", async () => {
  const { saudeNoEnderecoAntigo } = await import("@/modules/saude");
  return {
    MODULOS: [],
    EXTERNOS: [{ prefixo: "/api/saude", plugin: saudeNoEnderecoAntigo }],
    ROTINAS: [],
  };
});

descreverComBanco("/api/saude (endereço do sistema antigo)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await criarApp();
  });
  afterAll(async () => {
    await app.close();
    await banco.encerrar();
  });

  it("responde o mesmo que /api/v1/saude, sem sessão", async () => {
    const nova = await app.inject({ method: "GET", url: "/api/v1/saude" });
    const antiga = await app.inject({ method: "GET", url: "/api/saude" });
    expect(antiga.statusCode).toBe(200);
    expect(antiga.statusCode).toBe(nova.statusCode);
    expect(antiga.json()).toEqual(nova.json());
    expect(antiga.json()).toEqual({ ok: true });
  });
});
