import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { rotasDeAuth } from "./auth.routes";

/** Plugin do módulo: registra as rotas de cada recurso. */
export const auth: FastifyPluginAsyncZod = async (app) => {
  await app.register(rotasDeAuth);
};
