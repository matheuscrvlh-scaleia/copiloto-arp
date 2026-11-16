import {
  entradaConfirmarAgua,
  entradaEnvioAgua,
  entradaPreviaAgua,
  entradaVinculo,
  respostaConfirmarAgua,
  respostaEnvioAgua,
  respostaExtratoDaAgua,
  respostaHidrometroDaAgua,
  respostaMesDaAgua,
  respostaMesesDaAgua,
  respostaPreviaAbertaAgua,
  respostaPreviaAgua,
} from "@arp/shared/operacoes/contratos/agua";
import { respostaMensagem } from "@arp/shared/operacoes/contratos/base";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as controller from "./agua.controller";
import * as importacao from "./agua-importacao.controller";

// Água (prefixo /api/v1/operacoes/agua): as telas, o extrato em PDF, o
// vínculo do hidrômetro e a importação mensal.

const buscaDoExtrato = z.object({
  bloco: z.string().max(10).optional(),
  q: z.string().max(120).optional(),
  h: z.string().max(60).optional(),
  de: z.string().max(10).optional(),
  ate: z.string().max(10).optional(),
});
const comId = z.object({ id: z.uuid() });

export const rotasDaAgua: FastifyPluginAsyncZod = async (app) => {
  const ver = { permissao: "operacoes.agua.ver" } as const;
  const importar = { permissao: "operacoes.agua.importar" } as const;
  const vinculo = { permissao: "operacoes.agua.vinculo" } as const;

  app.get(
    "/meses",
    { config: ver, schema: { response: { 200: respostaMesesDaAgua } } },
    controller.meses,
  );

  app.get(
    "/meses/:referencia",
    {
      config: ver,
      schema: {
        params: z.object({ referencia: z.string().max(10) }),
        response: { 200: respostaMesDaAgua },
      },
    },
    controller.mes,
  );

  app.get(
    "/extrato",
    {
      config: ver,
      schema: {
        querystring: buscaDoExtrato,
        response: { 200: respostaExtratoDaAgua },
      },
    },
    controller.extrato,
  );

  // Exige também operacoes.exportar (o service confere).
  app.get(
    "/extrato/pdf",
    { config: ver, schema: { querystring: buscaDoExtrato } },
    controller.extratoEmPdf,
  );

  app.get(
    "/hidrometros/:hidrometro",
    {
      config: ver,
      schema: {
        params: z.object({ hidrometro: z.string().max(120) }),
        response: { 200: respostaHidrometroDaAgua },
      },
    },
    controller.hidrometro,
  );

  app.post(
    "/vinculos",
    {
      config: vinculo,
      schema: { body: entradaVinculo, response: { 200: respostaMensagem } },
    },
    controller.corrigirVinculo,
  );

  app.delete(
    "/vinculos/:id",
    {
      config: vinculo,
      schema: { params: comId, response: { 200: respostaMensagem } },
    },
    controller.removerVinculo,
  );

  app.post(
    "/importacao/envio",
    {
      config: importar,
      schema: { body: entradaEnvioAgua, response: { 200: respostaEnvioAgua } },
    },
    importacao.prepararEnvio,
  );

  app.post(
    "/importacao/previa",
    {
      config: importar,
      schema: {
        body: entradaPreviaAgua,
        response: { 200: respostaPreviaAgua },
      },
    },
    importacao.previa,
  );

  app.get(
    "/importacao/previa-aberta",
    {
      config: importar,
      schema: { response: { 200: respostaPreviaAbertaAgua } },
    },
    importacao.previaAberta,
  );

  app.delete(
    "/importacao/envios/:envio",
    {
      config: importar,
      schema: {
        params: z.object({ envio: z.uuid() }),
        response: { 200: respostaMensagem },
      },
    },
    importacao.limparEnvio,
  );

  app.post(
    "/importacao/:id/confirmar",
    {
      config: importar,
      schema: {
        params: comId,
        body: entradaConfirmarAgua,
        response: { 200: respostaConfirmarAgua },
      },
    },
    importacao.confirmar,
  );

  app.post(
    "/importacao/:id/descartar",
    {
      config: importar,
      schema: { params: comId, response: { 200: respostaMensagem } },
    },
    importacao.descartar,
  );
};
