import { respostaMensagem } from "@arp/shared/comercial/contratos/base";
import {
  entradaConfirmacao,
  paramsImportacao,
  paramsTipoImportacao,
  respostaConfirmacao,
  respostaImportacoes,
  respostaPrevia,
  respostaTiposImportacao,
} from "@arp/shared/comercial/contratos/importacoes";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./importacoes.controller";

// Importações do histórico. Contrato: @arp/shared/comercial/contratos/importacoes.
// A permissão é por tipo (comercial.pode_importar no banco): o service confere.

const BASE = "/importacoes";
const LOGADO = { acesso: "autenticado" } as const;

export const rotasDeImportacoes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    BASE,
    { config: LOGADO, schema: { response: { 200: respostaImportacoes } } },
    controller.importacoes,
  );

  app.get(
    `${BASE}/tipos`,
    { config: LOGADO, schema: { response: { 200: respostaTiposImportacao } } },
    controller.tipos,
  );

  // multipart (o arquivo): o controller lê com lerFormulario.
  app.post(
    `${BASE}/:tipo/previa`,
    {
      config: LOGADO,
      schema: {
        params: paramsTipoImportacao,
        response: { 200: respostaPrevia },
      },
    },
    controller.previa,
  );

  app.post(
    `${BASE}/:tipo/confirmar`,
    {
      config: LOGADO,
      schema: {
        params: paramsTipoImportacao,
        body: entradaConfirmacao,
        response: { 200: respostaConfirmacao },
      },
    },
    controller.confirmar,
  );

  app.post(
    `${BASE}/:id/desfazer`,
    {
      config: LOGADO,
      schema: { params: paramsImportacao, response: { 200: respostaMensagem } },
    },
    controller.desfazer,
  );
};
