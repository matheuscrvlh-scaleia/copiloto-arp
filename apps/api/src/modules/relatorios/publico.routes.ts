import {
  entradaResponder,
  parametroToken,
  respostaArquivo,
  respostaDoLink,
  respostaEnviado,
} from "@arp/shared/formularios/contratos";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./publico.controller";

// /api/v1/relatorios/publico/:token: a tela /responder/<token>, sem login.
// Vale o token (conferido no service); rota pública tem o limite reforçado
// de requisições por IP, e gravar exige X-ARP e Origin do site como as
// outras.

export const rotasDoPublico: FastifyPluginAsyncZod = async (app) => {
  const publico = { acesso: "publico" } as const;

  app.get(
    "/publico/:token",
    {
      config: publico,
      schema: { params: parametroToken, response: { 200: respostaDoLink } },
    },
    controller.formulario,
  );

  app.post(
    "/publico/:token/respostas",
    {
      config: publico,
      schema: {
        params: parametroToken,
        body: entradaResponder,
        response: { 200: respostaEnviado },
      },
    },
    controller.responder,
  );

  // Multipart (campo + arquivo): o controller lê e valida.
  app.post(
    "/publico/:token/arquivos",
    {
      config: publico,
      schema: { params: parametroToken, response: { 200: respostaArquivo } },
    },
    controller.enviarArquivo,
  );
};
