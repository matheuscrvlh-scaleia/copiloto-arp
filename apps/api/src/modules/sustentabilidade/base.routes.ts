import {
  respostaColetores,
  respostaContextoSu,
  respostaParametrosSu,
} from "@arp/shared/sustentabilidade/contratos/base";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./base.controller";

// Base do Sustentabilidade (prefixo /api/v1/sustentabilidade). Os parâmetros
// e os coletores valem para quem tem qualquer permissão do módulo, inclusive
// "Programa – lançar" (fora do catálogo fixo): por isso a rota é
// "autenticado" e o service confere no banco (sustentabilidade.acessa).

export const rotasDaBase: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/contexto",
    {
      config: { acesso: "autenticado" },
      schema: { response: { 200: respostaContextoSu } },
    },
    controller.contexto,
  );

  app.get(
    "/parametros",
    {
      config: { acesso: "autenticado" },
      schema: { response: { 200: respostaParametrosSu } },
    },
    controller.parametros,
  );

  app.get(
    "/coletores",
    {
      config: { acesso: "autenticado" },
      schema: { response: { 200: respostaColetores } },
    },
    controller.coletores,
  );
};
