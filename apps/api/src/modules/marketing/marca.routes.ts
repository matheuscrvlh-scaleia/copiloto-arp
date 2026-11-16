import { respostaMensagem } from "@arp/shared/contratos/auth";
import {
  entradaBloco,
  entradaEnvio,
  entradaNovoArquivo,
  entradaRegistro,
  respostaArquivos,
  respostaBlocos,
  respostaEnvio,
  respostaNovoArquivo,
  respostaVersoes,
} from "@arp/shared/marketing/contratos/marca";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as controller from "./marca.controller";

// Marca (prefixo /api/v1/marketing/marca). Contrato:
// @arp/shared/marketing/contratos/marca. Ler pede marketing.marca; as
// gravações conferem marketing.marca.editar no service (com a mensagem do
// antigo) e o RLS confere de novo.

export const rotasDaMarca: FastifyPluginAsyncZod = async (app) => {
  const ler = { permissao: "marketing.marca" } as const;
  const gravar = { acesso: "autenticado" } as const;
  app.get(
    "/blocos",
    { config: ler, schema: { response: { 200: respostaBlocos } } },
    controller.blocos,
  );
  app.get(
    "/versoes",
    { config: ler, schema: { response: { 200: respostaVersoes } } },
    controller.versoes,
  );
  app.get(
    "/arquivos",
    { config: ler, schema: { response: { 200: respostaArquivos } } },
    controller.arquivos,
  );
  // As duas abaixo têm a mensagem própria do antigo (o service confere).
  app.get(
    "/arquivos/:id",
    {
      config: gravar,
      schema: { params: z.object({ id: z.string().max(100) }) },
    },
    controller.baixarArquivo,
  );
  app.get("/pdf", { config: gravar }, controller.pdf);
  app.post(
    "/blocos",
    {
      config: gravar,
      schema: { body: entradaBloco, response: { 200: respostaMensagem } },
    },
    controller.salvarBloco,
  );
  app.post(
    "/versoes/:id/volta",
    {
      config: gravar,
      schema: {
        params: z.object({
          id: z.coerce.number().int().positive("Versão inválida."),
        }),
        response: { 200: respostaMensagem },
      },
    },
    controller.voltarVersao,
  );
  app.post(
    "/arquivos",
    {
      config: gravar,
      schema: {
        body: entradaNovoArquivo,
        response: { 200: respostaNovoArquivo },
      },
    },
    controller.novoArquivo,
  );
  app.post(
    "/arquivos/envio",
    {
      config: gravar,
      schema: { body: entradaEnvio, response: { 200: respostaEnvio } },
    },
    controller.prepararEnvio,
  );
  app.post(
    "/arquivos/registro",
    {
      config: gravar,
      schema: { body: entradaRegistro, response: { 200: respostaMensagem } },
    },
    controller.registrarArquivo,
  );
};
