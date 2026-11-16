import { respostaMensagem } from "@arp/shared/contratos/auth";
import {
  consultaDoFechamento,
  entradaFecharCiclo,
  entradaSalvarFechamento,
  respostaFechamento,
} from "@arp/shared/rh/contratos/telas";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as controller from "./banco-horas.controller";

// /api/v1/rh/banco-de-horas: Jornada › Fechamento do banco de horas
// (rh.jornada). Fechar, salvar e finalizar pedem também rh.parametros e o
// custo individual (conferidos no service, com a mensagem de antes, e no RLS).

const doCiclo = z.object({ id: z.uuid() });

export const rotasDoBancoDeHoras: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/banco-de-horas",
    {
      config: { permissao: "rh.jornada" },
      schema: {
        querystring: consultaDoFechamento,
        response: { 200: respostaFechamento },
      },
    },
    controller.fechamento,
  );

  app.post(
    "/banco-de-horas/fechar",
    {
      config: { permissao: "rh.jornada" },
      schema: {
        body: entradaFecharCiclo,
        response: { 200: respostaMensagem },
      },
    },
    controller.fecharCiclo,
  );

  app.patch(
    "/banco-de-horas/ciclos/:id",
    {
      config: { permissao: "rh.jornada" },
      schema: {
        params: doCiclo,
        body: entradaSalvarFechamento,
        response: { 200: respostaMensagem },
      },
    },
    controller.salvarFechamento,
  );

  app.post(
    "/banco-de-horas/ciclos/:id/finalizar",
    {
      config: { permissao: "rh.jornada" },
      schema: { params: doCiclo, response: { 200: respostaMensagem } },
    },
    controller.finalizarCiclo,
  );
};
