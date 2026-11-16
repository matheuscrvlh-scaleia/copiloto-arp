import { respostaMensagem } from "@arp/shared/contratos/auth";
import {
  consultaArquivo,
  parametroFormulario,
  parametroResposta,
  resposta,
  respostaRespostas,
} from "@arp/shared/formularios/contratos";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./respostas.controller";

// /api/v1/relatorios/:id/respostas e o arquivo enviado numa resposta. Ver:
// formularios.ver ou formularios.editar; excluir: formularios.editar (o
// service confere; o RLS de novo).

export const rotasDasRespostas: FastifyPluginAsyncZod = async (app) => {
  const logado = { acesso: "autenticado" } as const;

  app.get(
    "/:id/respostas",
    {
      config: logado,
      schema: {
        params: parametroFormulario,
        response: { 200: respostaRespostas },
      },
    },
    controller.listar,
  );

  app.get(
    "/:id/respostas/:resposta",
    {
      config: logado,
      schema: { params: parametroResposta, response: { 200: resposta } },
    },
    controller.obter,
  );

  app.delete(
    "/:id/respostas/:resposta",
    {
      config: logado,
      schema: {
        params: parametroResposta,
        response: { 200: respostaMensagem },
      },
    },
    controller.excluir,
  );

  // Redireciona para o link assinado (sem schema de resposta).
  app.get(
    "/:id/arquivo",
    {
      config: logado,
      schema: { params: parametroFormulario, querystring: consultaArquivo },
    },
    controller.baixarArquivo,
  );
};
