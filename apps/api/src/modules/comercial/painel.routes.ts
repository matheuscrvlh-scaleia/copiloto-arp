import { respostaMensagem } from "@arp/shared/comercial/contratos/base";
import {
  consultaPainel,
  entradaMetas,
  respostaMetas,
  respostaPainel,
} from "@arp/shared/comercial/contratos/painel";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./painel.controller";

// Painel de indicadores e metas. Contrato: @arp/shared/comercial/contratos/painel.

export const rotasDoPainel: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/painel",
    {
      config: { permissao: "comercial.painel.ver" },
      schema: {
        querystring: consultaPainel,
        response: { 200: respostaPainel },
      },
    },
    controller.painel,
  );

  app.get(
    "/metas",
    {
      config: { permissao: "comercial.painel.metas" },
      schema: { response: { 200: respostaMetas } },
    },
    controller.metas,
  );

  app.put(
    "/metas",
    {
      config: { permissao: "comercial.painel.metas" },
      schema: { body: entradaMetas, response: { 200: respostaMensagem } },
    },
    controller.salvarMetas,
  );
};
