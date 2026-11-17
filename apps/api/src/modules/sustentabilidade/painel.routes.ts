import { respostaMensagem } from "@arp/shared/contratos/auth";
import {
  consultaDoPainel,
  mesDoRelatorio,
  respostaPainel,
} from "@arp/shared/sustentabilidade/contratos/painel";
import { camposDeFormulario } from "@arp/shared/sustentabilidade/contratos/parametros";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./painel.controller";

// Painel de Sustentabilidade (prefixo /api/v1/sustentabilidade): a tela, o
// relatório do mês em PDF e o fechar/reabrir do ano.
//
// O relatório é POST: gerar o PDF conclui o chamado recorrente do relatório
// (grava), e a API não tem GET que grava. Com POST valem o `X-ARP` e o
// `Origin` do próprio site, como em toda gravação.

export const rotasDoPainel: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/painel",
    {
      config: { permissao: "sustentabilidade.painel" },
      schema: {
        querystring: consultaDoPainel,
        response: { 200: respostaPainel },
      },
    },
    controller.painel,
  );

  app.post(
    "/relatorio/:mes",
    {
      config: { permissao: "sustentabilidade.painel" },
      schema: { params: mesDoRelatorio },
    },
    controller.relatorio,
  );

  app.post(
    "/painel/anos/fechar",
    {
      config: { permissao: "sustentabilidade.parametros" },
      schema: { body: camposDeFormulario, response: { 200: respostaMensagem } },
    },
    controller.fecharAno,
  );

  app.post(
    "/painel/anos/reabrir",
    {
      config: { permissao: "sustentabilidade.parametros" },
      schema: { body: camposDeFormulario, response: { 200: respostaMensagem } },
    },
    controller.reabrirAno,
  );
};
