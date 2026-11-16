import { respostaMensagem } from "@arp/shared/comercial/contratos/base";
import {
  consultaListaContratos,
  consultaVistoria,
  entradaEnvioAnexo,
  entradaPronto,
  entradaRegistrarAnexo,
  entradaSalvarContrato,
  entradaSalvarDistrato,
  entradaVistoriaDeEntrada,
  paramsAnexo,
  paramsId,
  respostaApoioContrato,
  respostaContrato,
  respostaContratosEnet,
  respostaEnvioAnexo,
  respostaFichaCarregada,
  respostaGravacao,
  respostaLink,
  respostaListaContratos,
  respostaVistoria,
  respostaVistoriaPuxada,
} from "@arp/shared/comercial/contratos/contratos";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./contratos.controller";

// Contratos e distratos. Contrato: @arp/shared/comercial/contratos/contratos.
// A tela pede ver, editar ou gerar (o service confere); gravação pede editar.

const BASE = "/contratos";
const QUEM_VE = { acesso: "autenticado" } as const;
const EDITA = { permissao: "comercial.contratos.editar" } as const;

export const rotasDeContratos: FastifyPluginAsyncZod = async (app) => {
  app.get(
    BASE,
    {
      config: QUEM_VE,
      schema: {
        querystring: consultaListaContratos,
        response: { 200: respostaListaContratos },
      },
    },
    controller.lista,
  );

  app.get(
    `${BASE}/apoio`,
    {
      config: QUEM_VE,
      schema: { response: { 200: respostaApoioContrato } },
    },
    controller.apoio,
  );

  app.get(
    `${BASE}/distratos/enet`,
    {
      config: EDITA,
      schema: { response: { 200: respostaContratosEnet } },
    },
    controller.contratosEnet,
  );

  app.get(
    `${BASE}/vistorias`,
    {
      config: QUEM_VE,
      schema: {
        querystring: consultaVistoria,
        response: { 200: respostaVistoria },
      },
    },
    controller.vistoria,
  );

  app.get(
    `${BASE}/anexos/:anexo/link`,
    {
      config: QUEM_VE,
      schema: { params: paramsAnexo, response: { 200: respostaLink } },
    },
    controller.linkDoAnexo,
  );

  app.get(
    `${BASE}/:id`,
    {
      config: QUEM_VE,
      schema: { params: paramsId, response: { 200: respostaContrato } },
    },
    controller.contrato,
  );

  app.post(
    BASE,
    {
      config: EDITA,
      schema: {
        body: entradaSalvarContrato,
        response: { 200: respostaGravacao },
      },
    },
    controller.salvarContrato,
  );

  app.post(
    `${BASE}/:id/pronto`,
    {
      config: EDITA,
      schema: {
        params: paramsId,
        body: entradaPronto,
        response: { 200: respostaGravacao },
      },
    },
    controller.marcarPronto,
  );

  app.post(
    `${BASE}/distratos`,
    {
      config: EDITA,
      schema: {
        body: entradaSalvarDistrato,
        response: { 200: respostaGravacao },
      },
    },
    controller.salvarDistrato,
  );

  app.post(
    `${BASE}/fichas/:id/carregar`,
    {
      config: EDITA,
      schema: { params: paramsId, response: { 200: respostaFichaCarregada } },
    },
    controller.carregarFicha,
  );

  app.post(
    `${BASE}/vistoria-de-entrada`,
    {
      config: EDITA,
      schema: {
        body: entradaVistoriaDeEntrada,
        response: { 200: respostaVistoriaPuxada },
      },
    },
    controller.puxarVistoria,
  );

  app.post(
    `${BASE}/:id/anexos/envio`,
    {
      config: EDITA,
      schema: {
        params: paramsId,
        body: entradaEnvioAnexo,
        response: { 200: respostaEnvioAnexo },
      },
    },
    controller.prepararAnexo,
  );

  app.post(
    `${BASE}/:id/anexos`,
    {
      config: EDITA,
      schema: {
        params: paramsId,
        body: entradaRegistrarAnexo,
        response: { 201: respostaMensagem },
      },
    },
    controller.registrarAnexo,
  );

  app.delete(
    `${BASE}/anexos/:anexo`,
    {
      config: EDITA,
      schema: { params: paramsAnexo, response: { 200: respostaMensagem } },
    },
    controller.removerAnexo,
  );
};
