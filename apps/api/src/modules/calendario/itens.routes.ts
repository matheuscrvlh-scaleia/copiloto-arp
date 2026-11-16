import {
  consultaItens,
  entradaConcluir,
  entradaItem,
  parametroItem,
  respostaItens,
} from "@arp/shared/calendario/contratos";
import { respostaMensagem } from "@arp/shared/contratos/auth";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./itens.controller";

// /api/v1/calendario/itens. Ler: calendario.ver (a permissão da agenda).
// Gravar: qualquer pessoa logada chega ao service, e quem decide é o RLS,
// como antes: cria quem tem calendario.criar; edita e exclui quem criou ou
// tem calendario.editar_todos; conclui quem criou, o responsável ou quem
// edita todos.

export const rotasDeItens: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/itens",
    {
      config: { permissao: "calendario.ver" },
      schema: {
        querystring: consultaItens,
        response: { 200: respostaItens },
      },
    },
    controller.listar,
  );

  app.post(
    "/itens",
    {
      config: { acesso: "autenticado" },
      schema: { body: entradaItem, response: { 201: respostaMensagem } },
    },
    controller.criar,
  );

  app.patch(
    "/itens/:id",
    {
      config: { acesso: "autenticado" },
      schema: {
        params: parametroItem,
        body: entradaItem,
        response: { 200: respostaMensagem },
      },
    },
    controller.atualizar,
  );

  app.delete(
    "/itens/:id",
    {
      config: { acesso: "autenticado" },
      schema: { params: parametroItem, response: { 200: respostaMensagem } },
    },
    controller.excluir,
  );

  app.post(
    "/itens/:id/concluir",
    {
      config: { acesso: "autenticado" },
      schema: {
        params: parametroItem,
        body: entradaConcluir,
        response: { 200: respostaMensagem },
      },
    },
    controller.concluir,
  );
};
