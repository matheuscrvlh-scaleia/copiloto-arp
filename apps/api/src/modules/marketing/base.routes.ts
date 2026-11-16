import {
  agendaDoSite,
  consultaHistorico,
  respostaBenchmark,
  respostaHistorico,
  respostaLandingPages,
  respostaLocatarios,
  respostaMetas,
  respostaParametros,
  respostaPublico,
  respostaReferencias,
  respostaRegras,
  respostaTemasECodigos,
} from "@arp/shared/marketing/contratos/base";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./base.controller";

// Base do Marketing (prefixo /api/v1/marketing). Contrato:
// @arp/shared/marketing/contratos/base. Os cadastros valem para quem usa o
// módulo (alguma permissão marketing.*: conferida no service).

export const rotasDaBase: FastifyPluginAsyncZod = async (app) => {
  const doModulo = { acesso: "autenticado" } as const;

  app.get(
    "/parametros",
    { config: doModulo, schema: { response: { 200: respostaParametros } } },
    controller.parametros,
  );
  app.get(
    "/locatarios",
    { config: doModulo, schema: { response: { 200: respostaLocatarios } } },
    controller.locatarios,
  );
  app.get(
    "/landing-pages",
    { config: doModulo, schema: { response: { 200: respostaLandingPages } } },
    controller.landingPages,
  );
  app.get(
    "/regras-alerta",
    { config: doModulo, schema: { response: { 200: respostaRegras } } },
    controller.regrasAlerta,
  );
  app.get(
    "/temas-e-codigos",
    { config: doModulo, schema: { response: { 200: respostaTemasECodigos } } },
    controller.temasECodigos,
  );
  app.get(
    "/metas",
    { config: doModulo, schema: { response: { 200: respostaMetas } } },
    controller.metas,
  );
  app.get(
    "/referencias",
    { config: doModulo, schema: { response: { 200: respostaReferencias } } },
    controller.referencias,
  );
  // null sem marketing.reputacao (conferida no banco).
  app.get(
    "/benchmark",
    { config: doModulo, schema: { response: { 200: respostaBenchmark } } },
    controller.benchmark,
  );
  // null sem marketing.publico (conferida no banco).
  app.get(
    "/publico",
    { config: doModulo, schema: { response: { 200: respostaPublico } } },
    controller.publico,
  );
  app.get(
    "/eventos/agenda",
    {
      config: { permissao: "marketing.eventos" },
      schema: { response: { 200: agendaDoSite } },
    },
    controller.agenda,
  );
  app.get(
    "/historico",
    {
      config: { permissao: "marketing.parametros" },
      schema: {
        querystring: consultaHistorico,
        response: { 200: respostaHistorico },
      },
    },
    controller.historico,
  );
};
