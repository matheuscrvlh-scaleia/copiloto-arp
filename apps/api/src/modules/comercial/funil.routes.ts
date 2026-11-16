import { respostaFunil } from "@arp/shared/comercial/contratos/funil";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./funil.controller";

// Funil comercial. Contrato: @arp/shared/comercial/contratos/funil.

export const rotasDoFunil: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/funil",
    {
      config: { permissao: "comercial.funil.ver" },
      schema: { response: { 200: respostaFunil } },
    },
    controller.funil,
  );
};
