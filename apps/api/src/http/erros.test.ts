import type { FastifyInstance } from "fastify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { criarApp } from "@/app";
import { env } from "@/config/env";
import { mensagemPadraoDoZod } from "@/config/zod";
import { ErroNaoEncontrado } from "@/erros";

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

// Link antigo de PDF/download ou link público vencido, aberto direto no
// navegador: a pessoa lê a resposta crua, então o erro sai como texto.
describe("erro em endereço aberto direto no navegador", () => {
  let app: FastifyInstance;
  const DO_NAVEGADOR =
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
  const arquivos: FastifyPluginAsyncZod = async (rotas) => {
    rotas.get("/laudo", { config: { acesso: "publico" } }, async () => {
      throw new ErroNaoEncontrado("Este link não está mais ativo.");
    });
    rotas.post("/gravar", { config: { acesso: "publico" } }, async () => {
      throw new ErroNaoEncontrado("Registro não encontrado.");
    });
    rotas.get("/quebrada", { config: { acesso: "publico" } }, async () => {
      throw new Error("detalhe do banco que ninguém deve ver");
    });
  };
  beforeAll(async () => {
    app = await criarApp([
      { prefixo: "/teste", plugin: deTeste },
      { prefixo: "/arquivos-de-teste", plugin: arquivos },
    ]);
  });
  afterAll(() => app.close());

  const abrir = (url: string, accept?: string) =>
    app.inject({ url, headers: accept ? { accept } : {} });

  it("navegador: só a mensagem, em texto simples, com o mesmo status", async () => {
    const r = await abrir("/api/v1/arquivos-de-teste/laudo", DO_NAVEGADOR);
    expect(r.statusCode).toBe(404);
    expect(r.headers["content-type"]).toBe("text/plain; charset=utf-8");
    expect(r.body).toBe("Este link não está mais ativo.");
  });

  it("navegador: validação, rota que não existe e erro interno também", async () => {
    const validacao = await abrir(
      "/api/v1/teste/validar?tipo=gas",
      DO_NAVEGADOR,
    );
    expect(validacao.statusCode).toBe(400);
    expect(validacao.body).toMatch(/^tipo: Opção inválida/);
    expect(validacao.body).not.toContain("{");

    const ausente = await abrir("/api/v1/nao-existe", DO_NAVEGADOR);
    expect(ausente.statusCode).toBe(404);
    expect(ausente.body).toBe("Rota não encontrada.");

    const interno = await abrir(
      "/api/v1/arquivos-de-teste/quebrada",
      DO_NAVEGADOR,
    );
    expect(interno.statusCode).toBe(500);
    expect(interno.body).toBe("Algo deu errado. Tente de novo em instantes.");
  });

  it("a tela (fetch, Accept JSON ou nenhum) continua recebendo o JSON", async () => {
    for (const accept of ["application/json", undefined]) {
      const r = await abrir("/api/v1/arquivos-de-teste/laudo", accept);
      expect(r.statusCode).toBe(404);
      expect(r.json()).toEqual({
        erro: {
          codigo: "nao_encontrado",
          mensagem: "Este link não está mais ativo.",
        },
      });
    }
  });

  it("gravação nunca vira texto, mesmo com Accept de navegador", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/arquivos-de-teste/gravar",
      headers: {
        accept: DO_NAVEGADOR,
        origin: env.SITE_URL,
        "x-arp": "1",
        "content-type": "application/json",
      },
      payload: {},
    });
    expect(r.statusCode).toBe(404);
    expect(r.json().erro.codigo).toBe("nao_encontrado");
  });
});
