import { respostaMensagem } from "@arp/shared/os/contratos/base";
import { planilha } from "@arp/shared/os/contratos/visoes";
import {
  consultaLaudo,
  consultaVistorias,
  detalheDaVistoria,
  idDaAssinatura,
  idDaVistoria,
  idDoAmbiente,
  paginaDaVistoria,
  respostaAmbienteIncluido,
  respostaAssinatura,
  respostaCriada,
  respostaEnvio,
  respostaFoto,
  respostaNovaVistoria,
  respostaVistorias,
  tokenDaVistoria,
} from "@arp/shared/os/contratos/vistorias";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as controller from "./vistorias.controller";

// /api/v1/os/vistorias: lista, nova, detalhe (editor), ambientes, fotos,
// assinaturas, duplicar, laudo e envio. Rotas com sessão; o service confere
// os.vistorias com as mensagens de antes. /api/v1/os/vistoria-publica: o link
// do locatário (sem login; o token é conferido a cada pedido).

const ACESSO = { acesso: "autenticado" } as const;
const PUBLICO = { acesso: "publico" } as const;
const comMensagem = { 200: respostaMensagem };
/** Formulário validado no service com o schema do contrato. */
const corpo = z.looseObject({});

export const rotasDeVistorias: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/vistorias",
    {
      config: ACESSO,
      schema: {
        querystring: consultaVistorias,
        response: { 200: respostaVistorias },
      },
    },
    controller.lista,
  );

  app.get(
    "/vistorias/exportacao",
    {
      config: ACESSO,
      schema: { querystring: consultaVistorias, response: { 200: planilha } },
    },
    controller.exportar,
  );

  app.get(
    "/vistorias/nova",
    { config: ACESSO, schema: { response: { 200: respostaNovaVistoria } } },
    controller.nova,
  );

  app.post(
    "/vistorias",
    {
      config: ACESSO,
      schema: { body: corpo, response: { 200: respostaCriada } },
    },
    controller.iniciar,
  );

  app.get(
    "/vistorias/:id",
    {
      config: ACESSO,
      schema: { params: idDaVistoria, response: { 200: detalheDaVistoria } },
    },
    controller.detalhe,
  );

  app.patch(
    "/vistorias/:id",
    {
      config: ACESSO,
      schema: { params: idDaVistoria, body: corpo, response: comMensagem },
    },
    controller.salvar,
  );

  app.post(
    "/vistorias/:id/duplicar",
    {
      config: ACESSO,
      schema: { params: idDaVistoria, response: { 200: respostaCriada } },
    },
    controller.duplicar,
  );

  app.get(
    "/vistorias/:id/laudo",
    {
      config: ACESSO,
      schema: { params: idDaVistoria, querystring: consultaLaudo },
    },
    controller.laudo,
  );

  app.post(
    "/vistorias/:id/envio",
    {
      config: ACESSO,
      schema: { params: idDaVistoria, response: { 200: respostaEnvio } },
    },
    controller.envio,
  );

  app.post(
    "/vistorias/:id/link-assinatura",
    {
      config: ACESSO,
      schema: { params: idDaVistoria, response: { 200: respostaEnvio } },
    },
    controller.linkDeAssinatura,
  );

  app.post(
    "/vistorias/:id/ambientes",
    {
      config: ACESSO,
      schema: {
        params: idDaVistoria,
        body: corpo,
        response: { 200: respostaAmbienteIncluido },
      },
    },
    controller.adicionarAmbiente,
  );

  app.put(
    "/vistorias/:id/ambientes/ordem",
    {
      config: ACESSO,
      schema: { params: idDaVistoria, body: corpo, response: comMensagem },
    },
    controller.ordenarAmbientes,
  );

  app.patch(
    "/vistorias/:id/ambientes/:ambiente",
    {
      config: ACESSO,
      schema: { params: idDoAmbiente, body: corpo, response: comMensagem },
    },
    controller.salvarAmbiente,
  );

  app.delete(
    "/vistorias/ambientes/:id",
    { config: ACESSO, schema: { params: idDaVistoria, response: comMensagem } },
    controller.removerAmbiente,
  );

  // Multipart (arquivo).
  app.post(
    "/vistorias/:id/ambientes/:ambiente/fotos",
    {
      config: ACESSO,
      schema: { params: idDoAmbiente, response: { 200: respostaFoto } },
    },
    controller.enviarFoto,
  );

  app.delete(
    "/vistorias/fotos/:id",
    { config: ACESSO, schema: { params: idDaVistoria, response: comMensagem } },
    controller.removerFoto,
  );

  // Multipart (arquivo PNG).
  app.post(
    "/vistorias/:id/assinaturas/:parte",
    {
      config: ACESSO,
      schema: { params: idDaAssinatura, response: { 200: respostaAssinatura } },
    },
    controller.salvarAssinatura,
  );

  app.delete(
    "/vistorias/:id/assinaturas/:parte",
    {
      config: ACESSO,
      schema: { params: idDaAssinatura, response: comMensagem },
    },
    controller.removerAssinatura,
  );

  // Link do locatário (sem login; limite por IP das rotas públicas).
  app.get(
    "/vistoria-publica/:token",
    {
      config: PUBLICO,
      schema: { params: tokenDaVistoria, response: { 200: paginaDaVistoria } },
    },
    controller.paginaPublica,
  );

  app.get(
    "/vistoria-publica/:token/laudo",
    { config: PUBLICO, schema: { params: tokenDaVistoria } },
    controller.laudoPublico,
  );

  // Multipart (nome, documento, concordo e o PNG da assinatura).
  app.post(
    "/vistoria-publica/:token/assinatura",
    {
      config: PUBLICO,
      schema: { params: tokenDaVistoria, response: comMensagem },
    },
    controller.assinarPublico,
  );
};
