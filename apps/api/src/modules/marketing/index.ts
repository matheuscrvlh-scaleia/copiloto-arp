import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { estenderIntegracao } from "@/modules/admin/conexoes";
import {
  iniciarAutorizacaoGoogle,
  iniciarAutorizacaoRd,
  iniciarAutorizacaoTikTok,
  revogarAutorizacaoGoogle,
} from "./autorizacao";
import { rotasDaBase } from "./base.routes";
import { TESTES_MARKETING } from "./conexoes";
import { rotasDasConfiguracoes } from "./configuracoes.routes";
import { rotasDasFontes } from "./fontes.routes";
import { rotasDasIntegracoes } from "./integracoes.routes";
import { rotasDaMarca } from "./marca.routes";
import { esquecerLeituras } from "./memoria";

/** Plugin do módulo Marketing: registra as rotas de cada recurso. */
export const marketing: FastifyPluginAsyncZod = async (app) => {
  await app.register(rotasDaBase);
  await app.register(rotasDasFontes, { prefix: "/fontes" });
  await app.register(rotasDasConfiguracoes);
  await app.register(rotasDasIntegracoes);
  await app.register(rotasDaMarca, { prefix: "/marca" });
};

export { retornosDoMarketing } from "./integracoes.routes";
export { rotinasDoMarketing } from "./jobs";

// O que cada ferramenta do Marketing tem de próprio em Administração ›
// Integrações (e no cartão de Marketing › Configurações › Integrações): o
// teste, o "Conectar com …" e, ao salvar ou testar, a releitura dos dados
// (o updateTag de antes).
estenderIntegracao("mkt_google", {
  testar: TESTES_MARKETING.mkt_google,
  autorizar: iniciarAutorizacaoGoogle("mkt_google"),
  aoRemover: () => revogarAutorizacaoGoogle("mkt_google"),
  aoMudar: () => esquecerLeituras("google"),
});
estenderIntegracao("mkt_youtube", {
  testar: TESTES_MARKETING.mkt_youtube,
  autorizar: iniciarAutorizacaoGoogle("mkt_youtube"),
  aoRemover: () => revogarAutorizacaoGoogle("mkt_youtube"),
});
estenderIntegracao("mkt_meta", {
  testar: TESTES_MARKETING.mkt_meta,
  aoMudar: () => esquecerLeituras("meta"),
});
estenderIntegracao("mkt_tiktok", {
  testar: TESTES_MARKETING.mkt_tiktok,
  autorizar: iniciarAutorizacaoTikTok,
});
estenderIntegracao("mkt_rd_station", {
  testar: TESTES_MARKETING.mkt_rd_station,
  autorizar: iniciarAutorizacaoRd,
});
estenderIntegracao("mkt_asana", {
  testar: TESTES_MARKETING.mkt_asana,
  aoMudar: () => esquecerLeituras("asana"),
});
estenderIntegracao("mkt_site", {
  testar: TESTES_MARKETING.mkt_site,
  aoMudar: () => esquecerLeituras("eventos_site"),
});
