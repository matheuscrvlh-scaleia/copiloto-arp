import {
  consultaDoEstacionamento,
  respostaEstacionamento,
} from "@arp/shared/financeiro/estacionamento";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./estacionamento.controller";

export const rotasDoEstacionamento: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/estacionamento",
    {
      config: { permissao: "financeiro.estacionamento" },
      schema: {
        querystring: consultaDoEstacionamento,
        response: { 200: respostaEstacionamento },
      },
    },
    controller.estacionamento,
  );
};
