import {
  esquemaHidrometro,
  esquemaSala,
} from "@arp/shared/operacoes/cadastros";
import { respostaMensagem } from "@arp/shared/operacoes/contratos/base";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as controller from "./configuracoes.controller";

// Gravações de Configurações de Operações (prefixo /api/v1/operacoes):
// cadastros (hidrômetros e salas; o service confere as permissões de cada
// um e o RLS de novo) e parâmetros (operacoes.parametros). As leituras
// estão em base.routes.ts.

const formulario = z.record(z.string(), z.unknown());

export const rotasDasConfiguracoes: FastifyPluginAsyncZod = async (app) => {
  const autenticado = { acesso: "autenticado" } as const;
  const parametros = { permissao: "operacoes.parametros" } as const;

  app.post(
    "/cadastros/hidrometros",
    {
      config: autenticado,
      schema: { body: esquemaHidrometro, response: { 200: respostaMensagem } },
    },
    controller.salvarHidrometro,
  );

  app.delete(
    "/cadastros/hidrometros/:id",
    {
      config: autenticado,
      schema: {
        params: z.object({ id: z.uuid("Hidrômetro inválido.") }),
        response: { 200: respostaMensagem },
      },
    },
    controller.excluirHidrometro,
  );

  app.post(
    "/cadastros/salas",
    {
      config: autenticado,
      schema: { body: esquemaSala, response: { 200: respostaMensagem } },
    },
    controller.salvarSala,
  );

  app.delete(
    "/cadastros/salas/:id",
    {
      config: autenticado,
      schema: {
        params: z.object({ id: z.uuid("Sala inválida.") }),
        response: { 200: respostaMensagem },
      },
    },
    controller.excluirSala,
  );

  app.patch(
    "/parametros",
    {
      config: parametros,
      schema: { body: formulario, response: { 200: respostaMensagem } },
    },
    controller.salvarParametros,
  );

  app.delete(
    "/parametros/exemplos",
    { config: parametros, schema: { response: { 200: respostaMensagem } } },
    controller.removerExemplos,
  );

  app.post(
    "/parametros/unidades-energia",
    {
      config: parametros,
      schema: { body: formulario, response: { 200: respostaMensagem } },
    },
    controller.salvarUnidade,
  );
};
