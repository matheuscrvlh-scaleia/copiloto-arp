import {
  paramsLuc,
  respostaLuc,
  respostaOcupacao,
} from "@arp/shared/comercial/contratos/ocupacao";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./ocupacao.controller";

// Ocupação e estoque. Contrato: @arp/shared/comercial/contratos/ocupacao.

export const rotasDaOcupacao: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/ocupacao",
    {
      config: { permissao: "comercial.ocupacao.ver" },
      schema: { response: { 200: respostaOcupacao } },
    },
    controller.ocupacao,
  );

  app.get(
    "/ocupacao/lucs/:numero",
    {
      config: { permissao: "comercial.ocupacao.ver" },
      schema: { params: paramsLuc, response: { 200: respostaLuc } },
    },
    controller.luc,
  );
};
