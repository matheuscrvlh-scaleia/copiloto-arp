import { respostaMensagem } from "@arp/shared/contratos/auth";
import {
  configDaIa,
  consultaDoUso,
  entradaAvaliacao,
  entradaLimite,
  entradaPergunta,
  entradaRemoverLimite,
  idDaConversa,
  respostaConfig,
  respostaConversa,
  respostaConversas,
  respostaEstado,
  respostaUso,
} from "@arp/shared/ia/contratos";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./ia.controller";

// IA ARP (prefixo /api/v1/ia). O chat: `ia.usar`; a gestão: `ia.gerenciar`.
// Estas rotas ficam fora do catálogo da própria IA (catalogo.ts).

/** Cada pergunta pode gerar várias chamadas à Claude: limite próprio. */
const LIMITE_DE_PERGUNTAS = { max: 20, timeWindow: "1 minute" } as const;

export const rotasDaIa: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/estado",
    {
      config: { permissao: "ia.usar" },
      schema: { response: { 200: respostaEstado } },
    },
    controller.estado,
  );

  app.post(
    "/perguntas",
    {
      config: { permissao: "ia.usar", rateLimit: LIMITE_DE_PERGUNTAS },
      schema: { body: entradaPergunta },
    },
    controller.perguntar,
  );

  app.patch(
    "/perguntas/:id/avaliacao",
    {
      config: { permissao: "ia.usar" },
      schema: {
        params: idDaConversa,
        body: entradaAvaliacao,
        response: { 200: respostaMensagem },
      },
    },
    controller.avaliar,
  );

  app.get(
    "/conversas",
    {
      config: { permissao: "ia.usar" },
      schema: { response: { 200: respostaConversas } },
    },
    controller.conversas,
  );

  app.get(
    "/conversas/:id",
    {
      config: { permissao: "ia.usar" },
      schema: { params: idDaConversa, response: { 200: respostaConversa } },
    },
    controller.conversa,
  );

  app.delete(
    "/conversas/:id",
    {
      config: { permissao: "ia.usar" },
      schema: { params: idDaConversa, response: { 200: respostaMensagem } },
    },
    controller.apagarConversa,
  );

  app.get(
    "/config",
    {
      config: { permissao: "ia.gerenciar" },
      schema: { response: { 200: respostaConfig } },
    },
    controller.config,
  );

  app.put(
    "/config",
    {
      config: { permissao: "ia.gerenciar" },
      schema: { body: configDaIa, response: { 200: respostaMensagem } },
    },
    controller.salvarConfig,
  );

  app.put(
    "/limites",
    {
      config: { permissao: "ia.gerenciar" },
      schema: { body: entradaLimite, response: { 200: respostaMensagem } },
    },
    controller.salvarLimite,
  );

  app.delete(
    "/limites/:tipo/:id",
    {
      config: { permissao: "ia.gerenciar" },
      schema: {
        params: entradaRemoverLimite,
        response: { 200: respostaMensagem },
      },
    },
    controller.removerLimite,
  );

  app.get(
    "/uso",
    {
      config: { permissao: "ia.gerenciar" },
      schema: { querystring: consultaDoUso, response: { 200: respostaUso } },
    },
    controller.uso,
  );
};
