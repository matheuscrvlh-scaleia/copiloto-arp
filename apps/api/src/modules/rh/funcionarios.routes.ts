import { respostaMensagem } from "@arp/shared/contratos/auth";
import { consultaDoPeriodo } from "@arp/shared/rh/contratos/comum";
import {
  entradaForaDoPonto,
  respostaFuncionarios,
  respostaPerfil,
} from "@arp/shared/rh/contratos/funcionarios";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as controller from "./funcionarios.controller";

// /api/v1/rh/funcionarios (tela RH › Funcionários, rh.funcionarios).

export const rotasDeFuncionarios: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/funcionarios",
    {
      config: { permissao: "rh.funcionarios" },
      schema: { response: { 200: respostaFuncionarios } },
    },
    controller.listar,
  );

  app.get(
    "/funcionarios/:id",
    {
      config: { permissao: "rh.funcionarios" },
      schema: {
        // Id que não é uuid é "não encontrado" (como antes), não 400.
        params: z.object({ id: z.string().max(100) }),
        querystring: consultaDoPeriodo,
        response: { 200: respostaPerfil },
      },
    },
    controller.perfil,
  );

  // A tela é de rh.funcionarios; quem altera precisa de rh.parametros
  // (conferido no service, com a mensagem de antes, e no RLS).
  app.post(
    "/funcionarios/:id/fora-do-ponto",
    {
      config: { permissao: "rh.funcionarios" },
      schema: {
        params: z.object({ id: z.uuid() }),
        body: entradaForaDoPonto,
        response: { 200: respostaMensagem },
      },
    },
    controller.marcarForaDoPonto,
  );
};
