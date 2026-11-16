import { respostaMensagem } from "@arp/shared/comercial/contratos/base";
import { formulario } from "@arp/shared/comercial/contratos/configuracoes";
import {
  respostaCep,
  respostaCnpj,
} from "@arp/shared/comercial/contratos/consultas";
import {
  consultaFichas,
  entradaFichaPublica,
  estadoDaFicha,
  estadoDoDocumento,
  paramsConsultaFicha,
  paramsDocumentoFicha,
  paramsDocumentoPublico,
  paramsFicha,
  paramsTokenFicha,
  respostaDemonstracaoFicha,
  respostaDetalheFicha,
  respostaFichaPublica,
  respostaFichas,
  respostaLinkFicha,
} from "@arp/shared/comercial/contratos/fichas";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./fichas.controller";

// Fichas cadastrais. Contrato: @arp/shared/comercial/contratos/fichas. A
// tela abre para quem vê fichas, gera link ou monta contrato (o service
// confere; o RLS também); dados só com comercial.formulario.ver; link com
// comercial.formulario.link.

const BASE = "/fichas";
const LOGADO = { acesso: "autenticado" } as const;
const LINK = { permissao: "comercial.formulario.link" } as const;

export const rotasDasFichas: FastifyPluginAsyncZod = async (app) => {
  app.get(
    BASE,
    {
      config: LOGADO,
      schema: {
        querystring: consultaFichas,
        response: { 200: respostaFichas },
      },
    },
    controller.lista,
  );

  app.get(
    `${BASE}/demonstracao`,
    {
      config: LOGADO,
      schema: { response: { 200: respostaDemonstracaoFicha } },
    },
    controller.demonstracao,
  );

  app.get(
    `${BASE}/:id`,
    {
      config: LOGADO,
      schema: { params: paramsFicha, response: { 200: respostaDetalheFicha } },
    },
    controller.detalhe,
  );

  app.get(
    `${BASE}/:id/pdf`,
    {
      config: { permissao: "comercial.formulario.ver" },
      schema: { params: paramsFicha },
    },
    controller.pdf,
  );

  app.get(
    `${BASE}/:id/documento/:doc`,
    {
      config: { permissao: "comercial.formulario.ver" },
      schema: { params: paramsDocumentoFicha },
    },
    controller.documento,
  );

  app.post(
    `${BASE}/links`,
    {
      config: LINK,
      schema: { body: formulario, response: { 200: respostaLinkFicha } },
    },
    controller.gerarLink,
  );

  app.post(
    `${BASE}/:id/reenviar`,
    {
      config: LINK,
      schema: { params: paramsFicha, response: { 200: respostaLinkFicha } },
    },
    controller.reenviar,
  );

  app.post(
    `${BASE}/:id/cancelar`,
    {
      config: LINK,
      schema: { params: paramsFicha, response: { 200: respostaMensagem } },
    },
    controller.cancelar,
  );
};

/**
 * /api/v1/ficha/:token: a ficha que o interessado preenche, sem login. Vale
 * o token (conferido no service a cada pedido); rota pública tem o limite
 * reforçado de requisições por IP, e gravar exige X-ARP e Origin do site.
 */
export const fichaPublica: FastifyPluginAsyncZod = async (app) => {
  const publico = { acesso: "publico" } as const;

  app.get(
    "/:token",
    {
      config: publico,
      schema: {
        params: paramsTokenFicha,
        response: { 200: respostaFichaPublica },
      },
    },
    controller.paginaPublica,
  );

  app.post(
    "/:token",
    {
      config: publico,
      schema: {
        params: paramsTokenFicha,
        body: entradaFichaPublica,
        response: { 200: estadoDaFicha },
      },
    },
    controller.salvarPublica,
  );

  // Multipart (tipo, documento, aceite e arquivo): o controller lê.
  app.post(
    "/:token/documentos",
    {
      config: publico,
      schema: {
        params: paramsTokenFicha,
        response: { 200: estadoDoDocumento },
      },
    },
    controller.enviarDocumento,
  );

  app.delete(
    "/:token/documentos/:id",
    {
      config: publico,
      schema: {
        params: paramsDocumentoPublico,
        response: { 200: estadoDoDocumento },
      },
    },
    controller.removerDocumento,
  );

  app.get(
    "/:token/consultas/cep/:valor",
    {
      config: publico,
      schema: { params: paramsConsultaFicha, response: { 200: respostaCep } },
    },
    controller.cep,
  );

  app.get(
    "/:token/consultas/cnpj/:valor",
    {
      config: publico,
      schema: { params: paramsConsultaFicha, response: { 200: respostaCnpj } },
    },
    controller.cnpj,
  );
};
