import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { rotasDoEstacionamento } from "./estacionamento.routes";

// Módulo Financeiro (prefixo /api/v1/financeiro). As telas do ENET ainda são
// marcadores no front; o Estacionamento (WPS) é a primeira com dados.

export const financeiro: FastifyPluginAsyncZod = async (app) => {
  await app.register(rotasDoEstacionamento);
};
