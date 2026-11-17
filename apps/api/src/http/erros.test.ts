import type { FastifyInstance } from "fastify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { criarApp } from "@/app";
import { mensagemPadraoDoZod } from "@/config/zod";

// Erro de validação da rota, por uma rota de mentira. Sem banco.

const deTeste: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/validar",
    {
      config: { acesso: "publico" },
      schema: {
        querystring: z.object({
          tipo: z.enum(["agua", "energia"]),
          dias: z.coerce.number().int().optional(),
          nome: z.string().min(2, "informe o nome").optional(),
        }),
      },
    },
    async () => ({ mensagem: "ok" }),
  );
};

describe("erro de validação da rota", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await criarApp([{ prefixo: "/teste", plugin: deTeste }]);
  });
  afterAll(() => app.close());

  const pedir = async (busca: string) => {
    const r = await app.inject(`/api/v1/teste/validar?${busca}`);
    return { status: r.statusCode, erro: r.json().erro };
  };

  it("mensagem padrão do Zod sai em português, com o campo na frente", async () => {
    const { status, erro } = await pedir("tipo=gas&dias=x");
    expect(status).toBe(400);
    expect(erro.codigo).toBe("validacao");
    expect(erro.campos.tipo).toMatch(/^Opção inválida/);
    expect(erro.campos.dias).toMatch(/^Entrada inválida/);
    expect(erro.mensagem).toBe(`tipo: ${erro.campos.tipo}`);
    for (const m of Object.values<string>(erro.campos)) {
      expect(m).not.toMatch(/Invalid|expected/);
      expect(mensagemPadraoDoZod(m)).toBe(true);
    }
  });

  it("mensagem do schema continua a mesma", async () => {
    const { erro } = await pedir("tipo=agua&nome=a");
    expect(erro.campos).toEqual({ nome: "informe o nome" });
    expect(erro.mensagem).toBe("nome: informe o nome");
    expect(mensagemPadraoDoZod("informe o nome")).toBe(false);
  });
});
