import { entradaEmpresa, respostaEmpresa } from "@arp/shared/admin/contratos";
import { respostaMensagem } from "@arp/shared/contratos/auth";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./empresa.controller";

// Dados da empresa (prefixo /api/v1/admin).

export const rotasDaEmpresa: FastifyPluginAsyncZod = async (app) => {
  // Toda pessoa logada lê (o Dashboard mostra o nome da empresa).
  app.get(
    "/empresa",
    {
      config: { acesso: "autenticado" },
      schema: { response: { 200: respostaEmpresa } },
    },
    controller.ler,
  );

  app.patch(
    "/empresa",
    {
      config: { permissao: "admin.empresa" },
      schema: { body: entradaEmpresa, response: { 200: respostaMensagem } },
    },
    controller.salvar,
  );
};
