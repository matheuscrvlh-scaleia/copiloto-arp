import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { rotasDeConfiguracoes } from "./configuracoes.routes";
import { rotasDeConsultas } from "./consultas.routes";
import { rotasDeContratos } from "./contratos.routes";
import { rotasDoFunil } from "./funil.routes";
import { rotasDeImportacoes } from "./importacoes.routes";
import { rotasDaOcupacao } from "./ocupacao.routes";
import { rotasDoPainel } from "./painel.routes";
import { rotasDoRelacionamento } from "./relacionamento.routes";
import { rotasDosVencimentos } from "./vencimentos.routes";

/** Plugin do módulo Comercial (prefixo /api/v1/comercial). */
export const comercial: FastifyPluginAsyncZod = async (app) => {
  await app.register(rotasDoPainel);
  await app.register(rotasDoFunil);
  await app.register(rotasDaOcupacao);
  await app.register(rotasDosVencimentos);
  await app.register(rotasDoRelacionamento);
  await app.register(rotasDeContratos);
  await app.register(rotasDeConfiguracoes);
  await app.register(rotasDeImportacoes);
  await app.register(rotasDeConsultas);
};
