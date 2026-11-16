import {
  paramsVencimento,
  respostaVencimento,
  respostaVencimentos,
} from "@arp/shared/comercial/contratos/vencimentos";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./vencimentos.controller";

// Vencimentos de contrato. Contrato: @arp/shared/comercial/contratos/vencimentos.

export const rotasDosVencimentos: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/vencimentos",
    {
      config: { permissao: "comercial.vencimentos.ver" },
      schema: { response: { 200: respostaVencimentos } },
    },
    controller.vencimentos,
  );

  app.get(
    "/vencimentos/:contrato",
    {
      config: { permissao: "comercial.vencimentos.ver" },
      schema: {
        params: paramsVencimento,
        response: { 200: respostaVencimento },
      },
    },
    controller.vencimento,
  );
};
