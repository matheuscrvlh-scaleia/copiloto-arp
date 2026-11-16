import { opcoesPublico } from "@arp/shared/calendario/contratos";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./publico.controller";

// /api/v1/calendario/publico: quem vê a agenda ou configura (o service
// confere as duas no banco antes da service role).

export const rotasDoPublico: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/publico",
    {
      config: { acesso: "autenticado" },
      schema: { response: { 200: opcoesPublico } },
    },
    controller.opcoes,
  );
};
