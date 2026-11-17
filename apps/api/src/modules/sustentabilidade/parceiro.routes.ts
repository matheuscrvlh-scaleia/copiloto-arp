import { respostaMensagem } from "@arp/shared/contratos/auth";
import {
  correcaoDoParceiro,
  entradaDoParceiro,
  respostaParceiro,
  tokenDoParceiro,
  tokenEIdDoParceiro,
} from "@arp/shared/sustentabilidade/contratos/parceiro";
import type { RateLimitOptions } from "@fastify/rate-limit";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./parceiro.controller";

// /api/v1/sustentabilidade/parceiro/:token: a página do parceiro
// (/parceiro/:token), sem login. Vale pelo token, conferido no service a
// cada chamada (hash no banco, link ativo de programa ativo). Além do
// limite por IP, o service conta os envios por link.

/** Abrir a página: o limite padrão das rotas públicas. */
const LER = { acesso: "publico" } as const;

/** Enviar e corrigir: mais apertado que o padrão das rotas públicas. */
const LIMITE_DE_ENVIO = {
  max: 10,
  timeWindow: "1 minute",
} as const satisfies RateLimitOptions;
const ENVIAR = { acesso: "publico", rateLimit: LIMITE_DE_ENVIO } as const;

export const rotasDoParceiro: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/parceiro/:token",
    {
      config: LER,
      schema: { params: tokenDoParceiro, response: { 200: respostaParceiro } },
    },
    controller.pagina,
  );

  app.post(
    "/parceiro/:token/lancamentos",
    {
      config: ENVIAR,
      schema: {
        params: tokenDoParceiro,
        body: entradaDoParceiro,
        response: { 201: respostaMensagem },
      },
    },
    controller.lancar,
  );

  app.patch(
    "/parceiro/:token/lancamentos/:id",
    {
      config: ENVIAR,
      schema: {
        params: tokenEIdDoParceiro,
        body: correcaoDoParceiro,
        response: { 200: respostaMensagem },
      },
    },
    controller.corrigir,
  );
};
