import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { rotasDaCasca } from "./casca.routes";

/** Plugin da casca (menu, sino, filtros lembrados): rotas direto em /api/v1. */
export const casca: FastifyPluginAsyncZod = async (app) => {
  await app.register(rotasDaCasca);
};
