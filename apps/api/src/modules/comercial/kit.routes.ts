import { respostaMensagem } from "@arp/shared/comercial/contratos/base";
import { formulario } from "@arp/shared/comercial/contratos/configuracoes";
import {
  consultaKitDoLuc,
  entradaArquivoKit,
  entradaEnvioKit,
  entradaNovoDocumentoKit,
  paramsKit,
  respostaDocumentoKit,
  respostaDocumentoKitCriado,
  respostaEnvioKit,
  respostaKit,
} from "@arp/shared/comercial/contratos/kit";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as controller from "./kit.controller";

// Kit de entrega. Contrato: @arp/shared/comercial/contratos/kit. Telas com
// kit.ver; arquivo e kit do LUC também para quem monta contrato (o RLS e o
// service conferem); gravações com kit.editar (conferido no banco antes do
// link de envio e de usar a service role).

const BASE = "/kit";
const EDITA = { permissao: "comercial.kit.editar" } as const;

export const rotasDoKit: FastifyPluginAsyncZod = async (app) => {
  app.get(
    BASE,
    {
      config: { permissao: "comercial.kit.ver" },
      schema: { response: { 200: respostaKit } },
    },
    controller.tela,
  );

  app.get(
    `${BASE}/documentos/:id`,
    {
      config: { permissao: "comercial.kit.ver" },
      schema: { params: paramsKit, response: { 200: respostaDocumentoKit } },
    },
    controller.documento,
  );

  app.get(
    `${BASE}/arquivo/:id`,
    {
      config: { acesso: "autenticado" },
      schema: { params: z.object({ id: z.string().max(60) }) },
    },
    controller.arquivo,
  );

  app.get(
    `${BASE}/luc`,
    {
      config: { acesso: "autenticado" },
      schema: { querystring: consultaKitDoLuc },
    },
    controller.kitDoLuc,
  );

  app.post(
    `${BASE}/documentos`,
    {
      config: EDITA,
      schema: {
        body: entradaNovoDocumentoKit,
        response: { 201: respostaDocumentoKitCriado },
      },
    },
    controller.novoDocumento,
  );

  app.patch(
    `${BASE}/documentos/:id`,
    {
      config: EDITA,
      schema: {
        params: paramsKit,
        body: formulario,
        response: { 200: respostaMensagem },
      },
    },
    controller.editarDocumento,
  );

  app.post(
    `${BASE}/documentos/:id/envio`,
    {
      config: EDITA,
      schema: {
        params: paramsKit,
        body: entradaEnvioKit,
        response: { 200: respostaEnvioKit },
      },
    },
    controller.prepararEnvio,
  );

  app.post(
    `${BASE}/documentos/:id/arquivo`,
    {
      config: EDITA,
      schema: {
        params: paramsKit,
        body: entradaArquivoKit,
        response: { 200: respostaMensagem },
      },
    },
    controller.registrarArquivo,
  );
};
