import {
  consultaDasAbertas,
  consultaDoRelatorio,
} from "@arp/shared/os/contratos/paineis";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./relatorios.controller";

// /api/v1/os/ordens/relatorios: os relatórios de OS em Excel e PDF (os
// antigos /os/ordens/relatorios/*). Como antes, pedem só a sessão: o service
// confere os.exportar e os valores saem só com os.custos.

const ACESSO = { acesso: "autenticado" } as const;

export const rotasDeRelatorios: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/ordens/relatorios/abertas",
    { config: ACESSO, schema: { querystring: consultaDasAbertas } },
    controller.abertas,
  );
  app.get(
    "/ordens/relatorios/rateio",
    { config: ACESSO, schema: { querystring: consultaDoRelatorio } },
    controller.rateio,
  );
  app.get(
    "/ordens/relatorios/terceirizados",
    { config: ACESSO, schema: { querystring: consultaDoRelatorio } },
    controller.terceirizados,
  );
};
