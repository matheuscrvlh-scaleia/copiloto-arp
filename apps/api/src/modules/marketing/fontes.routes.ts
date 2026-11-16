import {
  dadosAnuncios,
  dadosAsana,
  dadosRd,
  dadosRedes,
  dadosReputacao,
  dadosSite,
} from "@arp/shared/marketing/contratos/fontes";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./fontes.controller";

// Fontes do Marketing (prefixo /api/v1/marketing/fontes). Contrato:
// @arp/shared/marketing/contratos/fontes. Valem para quem usa o módulo
// (alguma permissão marketing.*: conferida no service); a tela confere a
// permissão de cada quadro, como o antigo.

export const rotasDasFontes: FastifyPluginAsyncZod = async (app) => {
  const config = { acesso: "autenticado" } as const;
  app.get(
    "/anuncios",
    { config, schema: { response: { 200: dadosAnuncios } } },
    controller.anuncios,
  );
  app.get(
    "/rd",
    { config, schema: { response: { 200: dadosRd } } },
    controller.rd,
  );
  app.get(
    "/rd-anuncios",
    { config, schema: { response: { 200: dadosRd } } },
    controller.rdAnuncios,
  );
  app.get(
    "/site",
    { config, schema: { response: { 200: dadosSite } } },
    controller.site,
  );
  app.get(
    "/redes",
    { config, schema: { response: { 200: dadosRedes } } },
    controller.redes,
  );
  app.get(
    "/asana",
    { config, schema: { response: { 200: dadosAsana } } },
    controller.asana,
  );
  app.get(
    "/reputacao",
    { config, schema: { response: { 200: dadosReputacao } } },
    controller.reputacao,
  );
};
