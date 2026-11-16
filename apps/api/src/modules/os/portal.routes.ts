import { respostaMensagem } from "@arp/shared/os/contratos/base";
import {
  consultaDasLojas,
  consultaDosLinks,
  entradaAgenda,
  entradaBloqueio,
  entradaCancelarAgendamento,
  entradaEncerrarAcesso,
  entradaLoja,
  entradaRemarcarAgendamento,
  idDoPortal,
  planilhaDoPortal,
  respostaAgenda,
  respostaAgendas,
  respostaGravacao,
  respostaLinks,
  respostaLoja,
  respostaLojas,
} from "@arp/shared/os/contratos/portal";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as controller from "./portal.controller";

// /api/v1/os/portal: tela interna do Portal lojista (/os/portal/**). Links
// e lojas: os.portal; agendas, bloqueios e horários: os.portal_agenda. As
// exportações pedem também os.exportar (conferida no service).

const PORTAL = { permissao: "os.portal" } as const;
const AGENDA = { permissao: "os.portal_agenda" } as const;

/** Id que a tela trouxe da URL: o service devolve null se não for um uuid. */
const idDaTela = z.object({ id: z.string().max(60) });

export const rotasDoPortal: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/portal/links",
    {
      config: PORTAL,
      schema: {
        querystring: consultaDosLinks,
        response: { 200: respostaLinks },
      },
    },
    controller.links,
  );

  app.get(
    "/portal/links/exportacao",
    {
      config: PORTAL,
      schema: {
        querystring: consultaDosLinks,
        response: { 200: planilhaDoPortal },
      },
    },
    controller.exportarLinks,
  );

  app.post(
    "/portal/acessos/encerrar",
    {
      config: PORTAL,
      schema: {
        body: entradaEncerrarAcesso,
        response: { 200: respostaMensagem },
      },
    },
    controller.encerrarAcesso,
  );

  app.get(
    "/portal/lojas",
    {
      config: PORTAL,
      schema: {
        querystring: consultaDasLojas,
        response: { 200: respostaLojas },
      },
    },
    controller.lojas,
  );

  app.get(
    "/portal/lojas/exportacao",
    {
      config: PORTAL,
      schema: {
        querystring: consultaDasLojas,
        response: { 200: planilhaDoPortal },
      },
    },
    controller.exportarLojas,
  );

  app.get(
    "/portal/lojas/:id",
    {
      config: PORTAL,
      schema: { params: idDaTela, response: { 200: respostaLoja } },
    },
    controller.loja,
  );

  app.post(
    "/portal/lojas",
    {
      config: PORTAL,
      schema: {
        body: entradaLoja,
        response: { 200: respostaGravacao, 201: respostaGravacao },
      },
    },
    controller.salvarLoja,
  );

  app.get(
    "/portal/agendas",
    { config: AGENDA, schema: { response: { 200: respostaAgendas } } },
    controller.agendas,
  );

  app.get(
    "/portal/agendas/:id",
    {
      config: AGENDA,
      schema: { params: idDaTela, response: { 200: respostaAgenda } },
    },
    controller.agenda,
  );

  app.post(
    "/portal/agendas",
    {
      config: AGENDA,
      schema: {
        body: entradaAgenda,
        response: { 200: respostaGravacao, 201: respostaGravacao },
      },
    },
    controller.salvarAgenda,
  );

  app.post(
    "/portal/bloqueios",
    {
      config: AGENDA,
      schema: { body: entradaBloqueio, response: { 201: respostaMensagem } },
    },
    controller.bloquear,
  );

  app.delete(
    "/portal/bloqueios/:id",
    {
      config: AGENDA,
      schema: { params: idDoPortal, response: { 200: respostaMensagem } },
    },
    controller.removerBloqueio,
  );

  app.post(
    "/portal/agendamentos/:id/remarcacao",
    {
      config: AGENDA,
      schema: {
        params: idDoPortal,
        body: entradaRemarcarAgendamento,
        response: { 200: respostaMensagem },
      },
    },
    controller.remarcarAgendamento,
  );

  app.post(
    "/portal/agendamentos/:id/cancelamento",
    {
      config: AGENDA,
      schema: {
        params: idDoPortal,
        body: entradaCancelarAgendamento,
        response: { 200: respostaMensagem },
      },
    },
    controller.cancelarAgendamento,
  );
};
