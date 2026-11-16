import { respostaMensagem } from "@arp/shared/contratos/auth";
import {
  respostaBeneficioCriado,
  respostaBeneficios,
} from "@arp/shared/rh/contratos/beneficios";
import { corpoDoFormulario } from "@arp/shared/rh/contratos/cadastros";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as controller from "./beneficios.controller";

// /api/v1/rh/beneficios (rh.beneficios): catálogo, quem recebe, valores do
// mês e o total do rateado. Os campos chegam como texto (o formulário) e o
// service valida com a mensagem de antes; o RLS confere de novo.

const BENEFICIOS = { permissao: "rh.beneficios" } as const;
const comCorpo = {
  body: corpoDoFormulario,
  response: { 200: respostaMensagem },
};
const comId = {
  params: z.object({ id: z.string().max(36) }),
  response: { 200: respostaMensagem },
};

export const rotasDosBeneficios: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/beneficios",
    { config: BENEFICIOS, schema: { response: { 200: respostaBeneficios } } },
    controller.beneficios,
  );

  app.post(
    "/beneficios",
    {
      config: BENEFICIOS,
      schema: {
        body: corpoDoFormulario,
        response: { 200: respostaMensagem, 201: respostaBeneficioCriado },
      },
    },
    controller.salvar,
  );

  app.post(
    "/beneficios/vinculos",
    { config: BENEFICIOS, schema: comCorpo },
    controller.vincular,
  );

  app.patch(
    "/beneficios/vinculos",
    { config: BENEFICIOS, schema: comCorpo },
    controller.salvarValorManual,
  );

  app.delete(
    "/beneficios/vinculos/:id",
    { config: BENEFICIOS, schema: comId },
    controller.removerVinculo,
  );

  app.post(
    "/beneficios/contratos",
    { config: BENEFICIOS, schema: comCorpo },
    controller.vincularContrato,
  );

  app.delete(
    "/beneficios/contratos/:id",
    { config: BENEFICIOS, schema: comId },
    controller.removerContrato,
  );

  app.post(
    "/beneficios/:id/vincular-pela-folha",
    { config: BENEFICIOS, schema: comId },
    controller.vincularPelaFolha,
  );

  app.post(
    "/beneficios/valores",
    { config: BENEFICIOS, schema: comCorpo },
    controller.salvarValoresDoMes,
  );

  // multipart (a planilha): o controller lê com lerFormulario.
  app.post(
    "/beneficios/valores/planilha",
    { config: BENEFICIOS, schema: { response: { 200: respostaMensagem } } },
    controller.importarValoresDoMes,
  );

  app.post(
    "/beneficios/totais",
    { config: BENEFICIOS, schema: comCorpo },
    controller.salvarTotalDoMes,
  );
};
