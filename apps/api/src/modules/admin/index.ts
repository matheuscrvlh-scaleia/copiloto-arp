import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { rotasDaEmpresa } from "./empresa.routes";
import { rotasDoHistorico } from "./historico.routes";
import { rotasDeIntegracoes } from "./integracoes.routes";
import { rotasDeUsuarios } from "./usuarios.routes";

/** Plugin da Administração: registra as rotas de cada recurso. */
export const admin: FastifyPluginAsyncZod = async (app) => {
  await app.register(rotasDeUsuarios);
  await app.register(rotasDaEmpresa);
  await app.register(rotasDoHistorico);
  await app.register(rotasDeIntegracoes);
};

export { retornoDoRdCrm } from "./integracoes.routes";
