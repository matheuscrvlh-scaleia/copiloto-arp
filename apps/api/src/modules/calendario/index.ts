import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { rotasDeItens } from "./itens.routes";
import { rotasDoPublico } from "./publico.routes";
import { rotasDeTipos } from "./tipos.routes";

/**
 * Calendário (prefixo /api/v1/calendario). Recursos:
 *   itens    a agenda (o RLS decide quem vê e quem altera cada item)
 *   tipos    tipos de item (Calendário › Tipos de item)
 *   publico  setores, cargos e pessoas para "quem vê" e o responsável
 * Contratos: @arp/shared/calendario/contratos; regra pura:
 * @arp/shared/calendario e @arp/shared/calendario/item.
 */
export const calendario: FastifyPluginAsyncZod = async (app) => {
  await app.register(rotasDeItens);
  await app.register(rotasDeTipos);
  await app.register(rotasDoPublico);
};
