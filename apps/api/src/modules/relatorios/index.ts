import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { rotasDoPublico } from "./publico.routes";
import { rotasDosRelatorios } from "./relatorios.routes";
import { rotasDasRespostas } from "./respostas.routes";

/**
 * Relatórios, o antigo Formulários (prefixo /api/v1/relatorios; schema
 * `formularios` no banco; permissões formularios.*). Recursos:
 *   relatorios  o relatório: lista, perguntas, link, situação, aparência
 *   respostas   o que chegou pelos links (e os arquivos enviados)
 *   publico     /responder/<token>, sem login
 * Contratos: @arp/shared/formularios/contratos; regras puras em
 * @arp/shared/formularios/*.
 */
export const relatorios: FastifyPluginAsyncZod = async (app) => {
  await app.register(rotasDoPublico);
  await app.register(rotasDosRelatorios);
  await app.register(rotasDasRespostas);
};
