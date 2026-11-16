import { respostaMensagem } from "@arp/shared/contratos/auth";
import {
  entradaFiltros,
  parametrosDaNotificacao,
  parametrosDosFiltros,
  respostaAvisos,
  respostaFiltros,
  respostaNotificacoes,
} from "@arp/shared/contratos/casca";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./casca.controller";

// Rotas da casca (prefixo /api/v1). Contrato: @arp/shared/contratos/casca.
// Qualquer pessoa logada chama; cada leitura devolve só o que é dela (RLS).
// Nenhuma conta como uso da sessão (só POST /auth/uso conta).

export const rotasDaCasca: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/avisos",
    {
      config: { acesso: "autenticado" },
      schema: { response: { 200: respostaAvisos } },
    },
    controller.avisos,
  );

  app.get(
    "/notificacoes",
    {
      config: { acesso: "autenticado" },
      schema: { response: { 200: respostaNotificacoes } },
    },
    controller.notificacoes,
  );

  app.post(
    "/notificacoes/:id/lida",
    {
      config: { acesso: "autenticado" },
      schema: {
        params: parametrosDaNotificacao,
        response: { 200: respostaMensagem },
      },
    },
    controller.marcarLida,
  );

  app.post(
    "/notificacoes/lidas",
    {
      config: { acesso: "autenticado" },
      schema: { response: { 200: respostaMensagem } },
    },
    controller.marcarTodasLidas,
  );

  app.get(
    "/preferencias/filtros/:modulo/:tela",
    {
      config: { acesso: "autenticado" },
      schema: {
        params: parametrosDosFiltros,
        response: { 200: respostaFiltros },
      },
    },
    controller.filtros,
  );

  app.put(
    "/preferencias/filtros/:modulo/:tela",
    {
      config: { acesso: "autenticado" },
      schema: {
        params: parametrosDosFiltros,
        body: entradaFiltros,
        response: { 200: respostaMensagem },
      },
    },
    controller.lembrarFiltros,
  );
};
