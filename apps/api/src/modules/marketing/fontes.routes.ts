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
    {
      config: {
        ...config,
        ia: "Anúncios por dia e campanha (Meta, Google, TikTok), a base da tela Performance de anúncios. Investimento no período = soma de meta.insights.spend (data date_start) + soma de google.linhas.metrics.cost_micros × 0,000001 (data segments.date) + soma de tiktok.linhas.spend (data stat_time_day). Custo por lead = investimento ÷ leads do RD (fonte /marketing/fontes/rd-anuncios). Nome de cada campanha: campanhas[].nome (id = campaign_id). Conversões da plataforma (meta.insights.actions do tipo lead) não são leads do RD e nunca se somam a eles.",
      },
      schema: { response: { 200: dadosAnuncios } },
    },
    controller.anuncios,
  );
  app.get(
    "/rd",
    {
      config: {
        ...config,
        ia: "Contatos e conversões do RD Station (todas as origens) e landing pages com visitas e conversões por dia. Leads no período = contagem de conversoes por created_at.",
      },
      schema: { response: { 200: dadosRd } },
    },
    controller.rd,
  );
  app.get(
    "/rd-anuncios",
    {
      config: {
        ...config,
        ia: "Leads vindos de anúncios (RD Station), usados no custo por lead. Lead de uma campanha = conversão (conversoes, data created_at) cujo traffic_campaign é igual ao nome de uma campanha de /marketing/fontes/anuncios (campanhas[].nome); a tela de anúncios só conta esses no custo por lead (os sem campanha ficam à parte).",
      },
      schema: { response: { 200: dadosRd } },
    },
    controller.rdAnuncios,
  );
  app.get(
    "/site",
    {
      config: {
        ...config,
        ia: "Google Analytics 4 por dia (ga4: sessões, usuários, canal, origem) e buscas do Google (buscas: cliques e impressões por termo). Some por período com calcular.",
      },
      schema: { response: { 200: dadosSite } },
    },
    controller.site,
  );
  app.get(
    "/redes",
    {
      config: {
        ...config,
        ia: "Redes sociais por dia (seguidores, alcance, interações) e posts/vídeos de Instagram, Facebook, YouTube e TikTok.",
      },
      schema: { response: { 200: dadosRedes } },
    },
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
