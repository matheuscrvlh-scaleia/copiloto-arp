import type { FastifyInstance } from "fastify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarApp } from "@/app";
import { lerFormulario } from "./formulario";

// Formulário com arquivo, por uma rota de mentira. Sem banco.

const deTeste: FastifyPluginAsyncZod = async (app) => {
  app.post(
    "/formulario",
    { config: { acesso: "publico" } },
    async (request) => {
      const f = await lerFormulario(request, {
        arquivos: 1,
        bytesPorArquivo: 10,
      });
      return {
        campos: f.campos,
        arquivos: f.arquivos.map((a) => ({
          campo: a.campo,
          nome: a.nome,
          tipo: a.tipo,
          tamanho: a.bytes.length,
        })),
      };
    },
  );
};

describe("lerFormulario", () => {
  let app: FastifyInstance;
  const origem = new URL(process.env.SITE_URL ?? "").origin;

  const enviar = (form: FormData) =>
    app.inject({
      method: "POST",
      url: "/api/v1/teste/formulario",
      headers: { origin: origem, "x-arp": "1" },
      payload: form,
    });

  beforeAll(async () => {
    app = await criarApp([{ prefixo: "/teste", plugin: deTeste }]);
  });
  afterAll(() => app.close());

  it("lê campos (repetido vira lista) e o arquivo", async () => {
    const form = new FormData();
    form.append("titulo", "Laudo");
    form.append("dias", "seg");
    form.append("dias", "qua");
    form.append("anexo", new Blob(["12345"], { type: "text/plain" }), "a.txt");
    const r = await enviar(form);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({
      campos: { titulo: "Laudo", dias: ["seg", "qua"] },
      arquivos: [
        { campo: "anexo", nome: "a.txt", tipo: "text/plain", tamanho: 5 },
      ],
    });
  });

  it("arquivo acima do limite da rota: 413 no formato de erro", async () => {
    const form = new FormData();
    form.append("anexo", new Blob(["x".repeat(11)]), "grande.bin");
    const r = await enviar(form);
    expect(r.statusCode).toBe(413);
    expect(r.json().erro.codigo).toBe("validacao");
  });

  it("corpo que não é formulário: recusado", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/teste/formulario",
      headers: { origin: origem, "x-arp": "1" },
      payload: { titulo: "x" },
    });
    expect(r.statusCode).toBe(406);
    expect(r.json().erro.codigo).toBe("validacao");
  });
});
