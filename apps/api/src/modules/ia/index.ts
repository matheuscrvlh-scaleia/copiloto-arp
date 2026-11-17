import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { ligarServidor } from "./consulta";
import { rotasDaIa } from "./ia.routes";

/** Plugin da IA ARP: o chat e a gestão. */
export const ia: FastifyPluginAsyncZod = async (app) => {
  // As leituras da IA passam pelo servidor inteiro (todas as rotas).
  ligarServidor(app);
  await app.register(rotasDaIa);
};
