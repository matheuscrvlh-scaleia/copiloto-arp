import { respostaMensagem } from "@arp/shared/os/contratos/base";
import {
  entradaAvaliacao,
  entradaEntrar,
  entradaReabertura,
  entradaRemarcacao,
  idDaCategoriaDoPortal,
  idDoPedidoDoPortal,
  quemPede,
  respostaEntrar,
  respostaInicioDoPortal,
  respostaNovoPedido,
  respostaPedidoCriado,
  respostaPedidoDoPortal,
} from "@arp/shared/os/contratos/portal";
import type { RateLimitOptions } from "@fastify/rate-limit";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./portal-publico.controller";

// /api/v1/os/portal-publico: o portal do lojista (telas /portal/**). Rotas
// públicas: não usam a sessão dos usuários do sistema. A loja entra com o
// CPF ou CNPJ e fica numa sessão própria (cookie do portal, portal-cookie.ts),
// conferida pelo service a cada chamada.

/** Leituras e ações da loja: uma tela faz um pedido por vez. */
const LIMITE = {
  max: 120,
  timeWindow: "1 minute",
} as const satisfies RateLimitOptions;

/** Entrada: além deste, o service conta os documentos errados por IP. */
const LIMITE_DA_ENTRADA = {
  max: 30,
  timeWindow: "1 minute",
} as const satisfies RateLimitOptions;

const PUBLICO = { acesso: "publico", rateLimit: LIMITE } as const;

export const rotasDoPortalPublico: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/portal-publico/inicio",
    { config: PUBLICO, schema: { response: { 200: respostaInicioDoPortal } } },
    controller.inicio,
  );

  app.get(
    "/portal-publico/categorias/:id",
    {
      config: PUBLICO,
      schema: {
        params: idDaCategoriaDoPortal,
        response: { 200: respostaNovoPedido },
      },
    },
    controller.novoPedido,
  );

  app.get(
    "/portal-publico/pedidos/:id",
    {
      config: PUBLICO,
      schema: {
        params: idDoPedidoDoPortal,
        response: { 200: respostaPedidoDoPortal },
      },
    },
    controller.pedido,
  );

  app.post(
    "/portal-publico/entrar",
    {
      config: { acesso: "publico", rateLimit: LIMITE_DA_ENTRADA },
      schema: { body: entradaEntrar, response: { 200: respostaEntrar } },
    },
    controller.entrar,
  );

  app.post(
    "/portal-publico/sair",
    { config: PUBLICO, schema: { response: { 200: respostaMensagem } } },
    controller.sair,
  );

  // multipart (fotos e anexos): o controller lê com lerFormulario.
  app.post(
    "/portal-publico/pedidos",
    { config: PUBLICO, schema: { response: { 201: respostaPedidoCriado } } },
    controller.enviarPedido,
  );

  // multipart (fotos e anexos): o controller lê com lerFormulario.
  app.post(
    "/portal-publico/pedidos/:id/respostas",
    {
      config: PUBLICO,
      schema: {
        params: idDoPedidoDoPortal,
        response: { 200: respostaMensagem },
      },
    },
    controller.responder,
  );

  app.post(
    "/portal-publico/pedidos/:id/avaliacao",
    {
      config: PUBLICO,
      schema: {
        params: idDoPedidoDoPortal,
        body: quemPede.extend(entradaAvaliacao.shape),
        response: { 200: respostaMensagem },
      },
    },
    controller.avaliar,
  );

  app.post(
    "/portal-publico/pedidos/:id/reabertura",
    {
      config: PUBLICO,
      schema: {
        params: idDoPedidoDoPortal,
        body: quemPede.extend(entradaReabertura.shape),
        response: { 200: respostaMensagem },
      },
    },
    controller.reabrir,
  );

  app.post(
    "/portal-publico/pedidos/:id/remarcacao",
    {
      config: PUBLICO,
      schema: {
        params: idDoPedidoDoPortal,
        body: quemPede.extend(entradaRemarcacao.shape),
        response: { 200: respostaMensagem },
      },
    },
    controller.remarcar,
  );
};
