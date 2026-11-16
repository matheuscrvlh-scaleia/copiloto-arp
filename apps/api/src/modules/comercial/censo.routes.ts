import { respostaMensagem } from "@arp/shared/comercial/contratos/base";
import {
  consultaFeedbacksCenso,
  consultaPanoramaCenso,
  paramsConvite,
  paramsRodada,
  paramsTokenCenso,
  respostaCenso,
  respostaCensoPublico,
  respostaConviteCenso,
  respostaFeedbacksCenso,
  respostaIndicadoresCenso,
  respostaQuestionarioCenso,
  respostaRodadaCenso,
  respostaRodadasCenso,
} from "@arp/shared/comercial/contratos/censo";
import { formulario } from "@arp/shared/comercial/contratos/configuracoes";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./censo.controller";

// Censo. Contrato: @arp/shared/comercial/contratos/censo. Leituras com
// comercial.censo.ver; aba Rodadas, convites, lançamento presencial e temas
// com comercial.censo.aplicar (o RLS confere de novo). O panorama em PDF
// pede também comercial.exportar (o service confere).

const BASE = "/censo";
const VER = { permissao: "comercial.censo.ver" } as const;
const APLICAR = { permissao: "comercial.censo.aplicar" } as const;
const ok = { response: { 200: respostaMensagem } };

export const rotasDoCenso: FastifyPluginAsyncZod = async (app) => {
  app.get(
    BASE,
    { config: VER, schema: { response: { 200: respostaCenso } } },
    controller.tela,
  );

  app.get(
    `${BASE}/indicadores`,
    { config: VER, schema: { response: { 200: respostaIndicadoresCenso } } },
    controller.indicadores,
  );

  app.get(
    `${BASE}/panorama`,
    { config: VER, schema: { querystring: consultaPanoramaCenso } },
    controller.panorama,
  );

  app.get(
    `${BASE}/feedbacks`,
    {
      config: VER,
      schema: {
        querystring: consultaFeedbacksCenso,
        response: { 200: respostaFeedbacksCenso },
      },
    },
    controller.feedbacks,
  );

  app.get(
    `${BASE}/rodadas`,
    { config: APLICAR, schema: { response: { 200: respostaRodadasCenso } } },
    controller.rodadas,
  );

  app.get(
    `${BASE}/rodadas/:id`,
    {
      config: APLICAR,
      schema: { params: paramsRodada, response: { 200: respostaRodadaCenso } },
    },
    controller.rodada,
  );

  app.get(
    `${BASE}/demonstracao`,
    { config: VER, schema: { response: { 200: respostaQuestionarioCenso } } },
    controller.demonstracao,
  );

  app.get(
    `${BASE}/presencial/:convite`,
    {
      config: APLICAR,
      schema: {
        params: paramsConvite,
        response: { 200: respostaConviteCenso },
      },
    },
    controller.presencial,
  );

  app.post(
    `${BASE}/rodadas`,
    { config: APLICAR, schema: { body: formulario, ...ok } },
    controller.abrirRodada,
  );

  app.post(
    `${BASE}/rodadas/:id/convites`,
    { config: APLICAR, schema: { params: paramsRodada, ...ok } },
    controller.gerarConvites,
  );

  app.post(
    `${BASE}/rodadas/:id/encerrar`,
    { config: APLICAR, schema: { params: paramsRodada, ...ok } },
    controller.encerrarRodada,
  );

  app.post(
    `${BASE}/convites/:id/enviado`,
    { config: APLICAR, schema: { params: paramsRodada, ...ok } },
    controller.conviteEnviado,
  );

  // Presencial (aplicar) ou demonstração (ver): o service confere o modo.
  app.post(
    `${BASE}/respostas`,
    { config: VER, schema: { body: formulario, ...ok } },
    controller.responder,
  );

  app.post(
    `${BASE}/sugestoes/mover`,
    { config: APLICAR, schema: { body: formulario, ...ok } },
    controller.moverSugestao,
  );

  app.post(
    `${BASE}/temas`,
    { config: APLICAR, schema: { body: formulario, ...ok } },
    controller.salvarTema,
  );
};

/**
 * /api/v1/censo/:token: o questionário pelo link único da empresa, sem
 * login. Vale o token (conferido no service a cada pedido); rota pública
 * tem o limite reforçado de requisições por IP, e gravar exige X-ARP e
 * Origin do site.
 */
export const censoPublico: FastifyPluginAsyncZod = async (app) => {
  const publico = { acesso: "publico" } as const;

  app.get(
    "/:token",
    {
      config: publico,
      schema: {
        params: paramsTokenCenso,
        response: { 200: respostaCensoPublico },
      },
    },
    controller.publico,
  );

  app.post(
    "/:token",
    {
      config: publico,
      schema: { params: paramsTokenCenso, body: formulario, ...ok },
    },
    controller.responderPublico,
  );
};
