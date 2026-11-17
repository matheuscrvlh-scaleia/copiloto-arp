import { respostaMensagem } from "@arp/shared/operacoes/contratos/base";
import {
  entradaCadastroDaUnidade,
  entradaConfirmarFatura,
  respostaCadastroDaUnidade,
  respostaCreditosDoMes,
  respostaFatura,
  respostaFaturasAte,
  respostaGeracaoDoInversor,
  respostaLerFatura,
  respostaMesesComFatura,
  respostaPreviasDeFatura,
  respostaUnidadesDeEnergia,
} from "@arp/shared/operacoes/contratos/energia";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as controller from "./contas.controller";

// Contas de energia e energia solar (prefixo /api/v1/operacoes/energia):
// leitura para quem vê as contas ou a solar (o service confere; o RLS
// também) e a importação das faturas da Energisa.

const comMes = z.object({ mes: z.string().max(10) });
const importacao = z.object({ id: z.uuid("Importação inválida.") });

export const rotasDasContas: FastifyPluginAsyncZod = async (app) => {
  const leitura = { acesso: "autenticado" } as const;
  const importar = { permissao: "operacoes.energia.contas" } as const;

  app.get(
    "/unidades",
    {
      config: leitura,
      schema: { response: { 200: respostaUnidadesDeEnergia } },
    },
    controller.unidades,
  );

  app.get(
    "/contas/meses",
    { config: leitura, schema: { response: { 200: respostaMesesComFatura } } },
    controller.meses,
  );

  app.get(
    "/solar/inversor",
    {
      config: leitura,
      schema: { response: { 200: respostaGeracaoDoInversor } },
    },
    controller.geracaoDoInversor,
  );

  app.get(
    "/contas/faturas",
    {
      config: leitura,
      schema: { querystring: comMes, response: { 200: respostaFaturasAte } },
    },
    controller.faturas,
  );

  app.get(
    "/contas/faturas/:id",
    {
      config: leitura,
      schema: {
        params: z.object({ id: z.uuid("Fatura não encontrada.") }),
        response: { 200: respostaFatura },
      },
    },
    controller.fatura,
  );

  app.get(
    "/contas/creditos",
    {
      config: leitura,
      schema: { querystring: comMes, response: { 200: respostaCreditosDoMes } },
    },
    controller.creditos,
  );

  app.post(
    "/contas/importacao",
    { config: importar, schema: { response: { 200: respostaLerFatura } } },
    controller.lerFatura,
  );

  app.get(
    "/contas/importacao/previas",
    {
      config: importar,
      schema: { response: { 200: respostaPreviasDeFatura } },
    },
    controller.previasPendentes,
  );

  app.post(
    "/contas/importacao/:id/unidade",
    {
      config: importar,
      schema: {
        params: importacao,
        body: entradaCadastroDaUnidade,
        response: { 200: respostaCadastroDaUnidade },
      },
    },
    controller.cadastrarUnidade,
  );

  app.post(
    "/contas/importacao/:id/confirmar",
    {
      config: importar,
      schema: {
        params: importacao,
        body: entradaConfirmarFatura,
        response: { 200: respostaMensagem },
      },
    },
    controller.confirmar,
  );

  app.post(
    "/contas/importacao/:id/descartar",
    {
      config: importar,
      schema: { params: importacao, response: { 200: respostaMensagem } },
    },
    controller.descartar,
  );
};
