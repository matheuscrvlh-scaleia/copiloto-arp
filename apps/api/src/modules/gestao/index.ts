import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { rotasDaGestao } from "./gestao.routes";

/** Plugin da Gestão (o Dashboard). */
export const gestao: FastifyPluginAsyncZod = async (app) => {
  await app.register(rotasDaGestao);
};
