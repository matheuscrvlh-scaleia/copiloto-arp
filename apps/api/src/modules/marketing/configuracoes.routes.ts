import { respostaMensagem } from "@arp/shared/contratos/auth";
import {
  formulario,
  respostaPreviaCarga,
} from "@arp/shared/marketing/contratos/configuracoes";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as controller from "./configuracoes.controller";

// Gravações de Marketing › Configurações (prefixo /api/v1/marketing).
// Contrato: @arp/shared/marketing/contratos/configuracoes. A rota pede
// sessão (a carga, marketing.parametros); o service confere a permissão no banco e valida o
// formulário com as mensagens do sistema antigo.

// A mensagem de "sem permissão" é a do antigo: quem confere é o service.
const config = { acesso: "autenticado" } as const;
const MENSAGEM = { 200: respostaMensagem };
const comFormulario = { body: formulario, response: MENSAGEM };
const comId = { params: z.object({ id: z.string().max(100) }) };

export const rotasDasConfiguracoes: FastifyPluginAsyncZod = async (app) => {
  const C = "/configuracoes";
  app.post(
    `${C}/locatarios`,
    { config, schema: comFormulario },
    controller.salvarLocatario,
  );
  app.delete(
    `${C}/locatarios/:id`,
    { config, schema: { ...comId, response: MENSAGEM } },
    controller.removerLocatario,
  );
  app.post(
    `${C}/locatarios/carga`,
    {
      config: { permissao: "marketing.parametros" },
      schema: { response: { 200: respostaPreviaCarga } },
    },
    controller.lerCarga,
  );
  app.post(
    `${C}/locatarios/carga/confirmacao`,
    { config, schema: comFormulario },
    controller.confirmarCarga,
  );
  app.post(
    `${C}/landing-pages`,
    { config, schema: comFormulario },
    controller.salvarLandingPage,
  );
  app.post(
    `${C}/metas`,
    { config, schema: comFormulario },
    controller.incluirMeta,
  );
  app.patch(
    `${C}/metas/:id`,
    { config, schema: { ...comId, ...comFormulario } },
    controller.alterarMeta,
  );
  app.delete(
    `${C}/metas/:id`,
    { config, schema: { ...comId, response: MENSAGEM } },
    controller.removerMeta,
  );
  app.patch(
    `${C}/regras`,
    { config, schema: comFormulario },
    controller.salvarRegra,
  );
  app.patch(
    `${C}/reputacao`,
    { config, schema: comFormulario },
    controller.salvarReputacao,
  );
  app.patch(
    `${C}/asana`,
    { config, schema: comFormulario },
    controller.salvarAsana,
  );
  app.post(
    `${C}/temas`,
    { config, schema: comFormulario },
    controller.salvarTema,
  );
  app.post(
    `${C}/codigos-ronda`,
    { config, schema: comFormulario },
    controller.salvarCodigoRonda,
  );
  app.delete(
    `${C}/codigos-ronda/:id`,
    { config, schema: { ...comId, response: MENSAGEM } },
    controller.removerCodigoRonda,
  );
  app.patch(
    `${C}/visualizacao`,
    { config, schema: comFormulario },
    controller.salvarVisualizacao,
  );
  app.patch(
    `${C}/termos-marca`,
    { config, schema: comFormulario },
    controller.salvarTermosMarca,
  );
  app.post(
    `${C}/referencias`,
    { config, schema: comFormulario },
    controller.salvarReferencia,
  );
  app.delete(
    `${C}/referencias/:id`,
    { config, schema: { ...comId, response: MENSAGEM } },
    controller.removerReferencia,
  );
  app.post(
    "/historico/:id/volta",
    {
      config,
      schema: {
        params: z.object({
          id: z.coerce.number().int().positive("Alteração inválida."),
        }),
        response: MENSAGEM,
      },
    },
    controller.voltarAlteracao,
  );
};
