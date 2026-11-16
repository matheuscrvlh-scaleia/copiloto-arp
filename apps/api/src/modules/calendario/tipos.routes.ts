import {
  entradaTipo,
  parametroTipo,
  respostaTipos,
} from "@arp/shared/calendario/contratos";
import { respostaMensagem } from "@arp/shared/contratos/auth";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./tipos.controller";

// /api/v1/calendario/tipos. Ler: quem vê a agenda ou configura (o service
// confere as duas). Gravar: calendario.configurar (e o RLS de novo).

export const rotasDeTipos: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/tipos",
    {
      config: { acesso: "autenticado" },
      schema: { response: { 200: respostaTipos } },
    },
    controller.listar,
  );

  app.post(
    "/tipos",
    {
      config: { permissao: "calendario.configurar" },
      schema: { body: entradaTipo, response: { 201: respostaMensagem } },
    },
    controller.criar,
  );

  app.patch(
    "/tipos/:id",
    {
      config: { permissao: "calendario.configurar" },
      schema: {
        params: parametroTipo,
        body: entradaTipo,
        response: { 200: respostaMensagem },
      },
    },
    controller.atualizar,
  );

  app.delete(
    "/tipos/:id",
    {
      config: { permissao: "calendario.configurar" },
      schema: { params: parametroTipo, response: { 200: respostaMensagem } },
    },
    controller.excluir,
  );
};
