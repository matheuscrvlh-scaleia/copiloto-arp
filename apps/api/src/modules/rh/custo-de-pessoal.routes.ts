import { respostaMensagem } from "@arp/shared/contratos/auth";
import {
  consultaDoCusto,
  respostaComparacao,
  respostaCustoDePessoal,
} from "@arp/shared/rh/contratos/custo";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./custo-de-pessoal.controller";

// /api/v1/rh/custo-de-pessoal: abas Dashboard e Comparação (rh.custo_pessoal)
// e o Recalcular (rh.folha ou rh.parametros, conferidos no service).

export const rotasDoCustoDePessoal: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/custo-de-pessoal",
    {
      config: { permissao: "rh.custo_pessoal" },
      schema: {
        querystring: consultaDoCusto,
        response: { 200: respostaCustoDePessoal },
      },
    },
    controller.dashboard,
  );

  app.get(
    "/custo-de-pessoal/comparacao",
    {
      config: { permissao: "rh.custo_pessoal" },
      schema: {
        querystring: consultaDoCusto,
        response: { 200: respostaComparacao },
      },
    },
    controller.comparacao,
  );

  app.post(
    "/custo-de-pessoal/recalcular",
    {
      config: { acesso: "autenticado" },
      schema: { response: { 200: respostaMensagem } },
    },
    controller.recalcular,
  );
};
