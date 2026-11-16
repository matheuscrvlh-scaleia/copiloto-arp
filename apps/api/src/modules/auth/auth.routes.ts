import {
  entradaEntrar,
  entradaTrocarSenha,
  respostaEu,
  respostaMensagem,
  respostaSessao,
} from "@arp/shared/contratos/auth";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { LIMITE_DE_LOGIN } from "@/http/seguranca";
import * as controller from "./auth.controller";

// Rotas do acesso (prefixo /api/v1/auth). Contrato: @arp/shared/contratos/auth.

export const rotasDeAuth: FastifyPluginAsyncZod = async (app) => {
  app.post(
    "/entrar",
    {
      config: { acesso: "publico", rateLimit: LIMITE_DE_LOGIN },
      schema: { body: entradaEntrar, response: { 200: respostaEu } },
    },
    controller.entrar,
  );

  app.get(
    "/eu",
    {
      config: { acesso: "autenticado", comSenhaProvisoria: true },
      schema: { response: { 200: respostaEu } },
    },
    controller.eu,
  );

  // Pública: vale o cookie de renovação (o de acesso já venceu).
  app.post(
    "/renovar",
    {
      config: { acesso: "publico" },
      schema: { response: { 200: respostaSessao } },
    },
    controller.renovar,
  );

  app.post(
    "/uso",
    {
      config: { acesso: "autenticado", comSenhaProvisoria: true },
      schema: { response: { 200: respostaSessao } },
    },
    controller.uso,
  );

  app.post(
    "/trocar-senha",
    {
      config: { acesso: "autenticado", comSenhaProvisoria: true },
      schema: {
        body: entradaTrocarSenha,
        response: { 200: respostaMensagem },
      },
    },
    controller.trocarSenha,
  );

  // Pública: sair funciona mesmo com o acesso vencido.
  app.post(
    "/sair",
    {
      config: { acesso: "publico" },
      schema: { response: { 200: respostaMensagem } },
    },
    controller.sair,
  );
};
