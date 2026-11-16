import { respostaMensagem } from "@arp/shared/operacoes/contratos/base";
import {
  buscaDasPartes,
  buscaDosRelatorios,
  respostaEstadoDoDiario,
  respostaObraDoDiario,
  respostaObrasDoDiario,
  respostaOpcoesDosRelatorios,
  respostaPartesDosRelatorios,
  respostaRelatorioCompleto,
  respostaRelatorios,
} from "@arp/shared/operacoes/contratos/diario";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as controller from "./diario.controller";

// Diário de Obra (prefixo /api/v1/operacoes/diario): a cópia do aplicativo
// com a sessão (RLS: operacoes.obras.diario ou operacoes.painel), o estado da
// consulta e o "Atualizar agora".

const comId = z.object({ id: z.string().max(64) });

export const rotasDoDiario: FastifyPluginAsyncZod = async (app) => {
  const diario = { permissao: "operacoes.obras.diario" } as const;

  app.get(
    "/estado",
    {
      config: { acesso: "autenticado" },
      schema: { response: { 200: respostaEstadoDoDiario } },
    },
    controller.estado,
  );

  app.get(
    "/obras",
    { config: diario, schema: { response: { 200: respostaObrasDoDiario } } },
    controller.obras,
  );

  app.get(
    "/obras/:id",
    {
      config: diario,
      schema: { params: comId, response: { 200: respostaObraDoDiario } },
    },
    controller.obra,
  );

  app.get(
    "/obras/:id/partes",
    {
      config: diario,
      schema: {
        params: comId,
        querystring: buscaDasPartes,
        response: { 200: respostaPartesDosRelatorios },
      },
    },
    controller.partes,
  );

  app.get(
    "/relatorios",
    {
      config: diario,
      schema: {
        querystring: buscaDosRelatorios,
        response: { 200: respostaRelatorios },
      },
    },
    controller.relatorios,
  );

  app.get(
    "/relatorios/opcoes",
    {
      config: diario,
      schema: { response: { 200: respostaOpcoesDosRelatorios } },
    },
    controller.opcoes,
  );

  app.get(
    "/relatorios/:id",
    {
      config: diario,
      schema: { params: comId, response: { 200: respostaRelatorioCompleto } },
    },
    controller.relatorio,
  );

  app.post(
    "/atualizar",
    {
      config: { permissao: "operacoes.obras.atualizar" },
      schema: { response: { 200: respostaMensagem } },
    },
    controller.atualizar,
  );
};
