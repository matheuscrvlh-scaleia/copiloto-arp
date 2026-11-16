import { respostaDescobertas } from "@arp/shared/marketing/contratos/configuracoes";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as controller from "./integracoes.controller";

// Integrações do Marketing (prefixo /api/v1/marketing). O salvar, testar e
// remover são as rotas de /api/v1/admin/integracoes (com o teste e a
// autorização de cada ferramenta ligados em index.ts); aqui fica o que a
// conta Google conectada acessa, para os campos de escolha do cartão. A
// permissão (marketing.parametros ou admin.integracoes) é do service.

export const rotasDasIntegracoes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/integracoes/:sistema/descobertas",
    {
      config: { acesso: "autenticado" },
      schema: {
        params: z.object({ sistema: z.enum(["mkt_google", "mkt_youtube"]) }),
        response: { 200: respostaDescobertas },
      },
    },
    controller.descobertas,
  );
};

const volta = z.object({
  code: z.string().max(4000).optional(),
  state: z.string().max(500).optional(),
  error: z.string().max(500).optional(),
  auth_code: z.string().max(4000).optional(),
});

/**
 * Endereços cadastrados nos apps do Google, do RD Station e do TikTok: ficam
 * FORA de /api/v1 (/api/integracoes/...) e não podem mudar. Públicos: vêm do
 * site da ferramenta, sem os cookies da sessão; vale o cookie do state (ver
 * autorizacao.ts).
 */
export const retornosDoMarketing: FastifyPluginAsyncZod = async (app) => {
  const config = { acesso: "publico" } as const;
  app.get(
    "/google/callback",
    { config, schema: { querystring: volta } },
    controller.retornoGoogle,
  );
  app.get(
    "/rd-station/retorno",
    { config, schema: { querystring: volta } },
    controller.retornoRd,
  );
  app.get(
    "/tiktok/retorno",
    { config, schema: { querystring: volta } },
    controller.retornoTikTok,
  );
};
