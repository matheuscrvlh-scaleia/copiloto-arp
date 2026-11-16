import {
  respostaDadosDeExemplo,
  respostaHidrometrosCadastrados,
  respostaHistoricoDosParametros,
  respostaParametros,
  respostaSalasCadastradas,
  respostaUnidadesDosParametros,
} from "@arp/shared/operacoes/contratos/base";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./base.controller";

// Base de Operações (prefixo /api/v1/operacoes). Os parâmetros valem para
// quem tem qualquer permissão do módulo (o service confere); os cadastros
// seguem o RLS.

export const rotasDaBase: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/parametros",
    {
      config: { acesso: "autenticado" },
      schema: { response: { 200: respostaParametros } },
    },
    controller.parametros,
  );

  app.get(
    "/parametros/historico",
    {
      config: { permissao: "operacoes.parametros" },
      schema: { response: { 200: respostaHistoricoDosParametros } },
    },
    controller.historicoDosParametros,
  );

  app.get(
    "/parametros/exemplos",
    {
      config: { permissao: "operacoes.parametros" },
      schema: { response: { 200: respostaDadosDeExemplo } },
    },
    controller.dadosDeExemplo,
  );

  app.get(
    "/parametros/unidades-energia",
    {
      config: { permissao: "operacoes.parametros" },
      schema: { response: { 200: respostaUnidadesDosParametros } },
    },
    controller.unidadesDeEnergia,
  );

  app.get(
    "/cadastros/hidrometros",
    {
      config: { acesso: "autenticado" },
      schema: { response: { 200: respostaHidrometrosCadastrados } },
    },
    controller.hidrometros,
  );

  app.get(
    "/cadastros/salas",
    {
      config: { acesso: "autenticado" },
      schema: { response: { 200: respostaSalasCadastradas } },
    },
    controller.salas,
  );
};
