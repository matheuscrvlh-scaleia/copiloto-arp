import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { censoPublico, rotasDoCenso } from "./censo.routes";
import { rotasDeConfiguracoes } from "./configuracoes.routes";
import { rotasDeConsultas } from "./consultas.routes";
import { rotasDeContratos } from "./contratos.routes";
import { rotasDosEventos } from "./eventos.routes";
import { fichaPublica, rotasDasFichas } from "./fichas.routes";
import { rotasDoFunil } from "./funil.routes";
import { rotasDeImportacoes } from "./importacoes.routes";
import { rotasDoKit } from "./kit.routes";
import { rotasDaOcupacao } from "./ocupacao.routes";
import { rotasDoPainel } from "./painel.routes";
import { rotasDaPesquisa } from "./pesquisa.routes";
import { rotasDoRelacionamento } from "./relacionamento.routes";
import { rotasDosVencimentos } from "./vencimentos.routes";

export { rotinasDoComercial } from "./jobs";
// Parte B: o questionário do Censo e a ficha cadastral pelo link (sem login).
export { censoPublico, fichaPublica };

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
  await app.register(rotasDoCenso);
  await app.register(rotasDasFichas);
  await app.register(rotasDoKit);
  await app.register(rotasDosEventos);
  await app.register(rotasDaPesquisa);
};
