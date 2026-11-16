import {
  consultaDasIntegracoes,
  entradaIntegracao,
  parametrosDoSistema,
  respostaIntegracaoSalva,
  respostaIntegracoes,
} from "@arp/shared/admin/contratos";
import { respostaMensagem } from "@arp/shared/contratos/auth";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as controller from "./integracoes.controller";

// Integrações (prefixo /api/v1/admin). Servem a Administração › Integrações
// e Marketing › Configurações › Integrações: por isso a rota só exige
// sessão, e o service confere a permissão de cada sistema
// (admin.integracoes; marketing.parametros nas do Marketing).

const config = { acesso: "autenticado" } as const;
const doSistema = {
  params: parametrosDoSistema,
  response: { 200: respostaMensagem },
};

export const rotasDeIntegracoes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/integracoes",
    {
      config,
      schema: {
        querystring: consultaDasIntegracoes,
        response: { 200: respostaIntegracoes },
      },
    },
    controller.listar,
  );
  app.put(
    "/integracoes/:sistema",
    {
      config,
      schema: {
        params: parametrosDoSistema,
        body: entradaIntegracao,
        response: { 200: respostaIntegracaoSalva },
      },
    },
    controller.salvar,
  );
  app.post(
    "/integracoes/:sistema/teste",
    { config, schema: doSistema },
    controller.testar,
  );
  app.post(
    "/integracoes/:sistema/sincronizacao",
    { config, schema: doSistema },
    controller.sincronizar,
  );
  app.delete(
    "/integracoes/:sistema",
    { config, schema: doSistema },
    controller.remover,
  );
};

/**
 * Endereço cadastrado no app do RD Station CRM: fica FORA de /api/v1
 * (/api/integracoes/rd-crm/retorno) e não pode mudar. Pública: vem do site
 * do RD, sem os cookies da sessão; vale o cookie do state (ver
 * autorizacao-rd-crm.ts).
 */
export const retornoDoRdCrm: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/retorno",
    {
      config: { acesso: "publico" },
      schema: {
        querystring: z.object({
          code: z.string().max(2000).optional(),
          state: z.string().max(500).optional(),
        }),
      },
    },
    controller.retornoRdCrm,
  );
};
