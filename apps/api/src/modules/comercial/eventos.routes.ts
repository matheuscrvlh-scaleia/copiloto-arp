import { respostaMensagem } from "@arp/shared/comercial/contratos/base";
import { formulario } from "@arp/shared/comercial/contratos/configuracoes";
import {
  consultaFeriadosEventos,
  entradaStatusProposta,
  paramsProposta,
  respostaApoioEventos,
  respostaEventos,
  respostaFeriadosEventos,
  respostaProposta,
  respostaPropostaCriada,
} from "@arp/shared/comercial/contratos/eventos";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./eventos.controller";

// Simulador e propostas de evento. Contrato:
// @arp/shared/comercial/contratos/eventos. A tela abre com eventos.ver; a
// proposta (detalhe e PDF) com .ver ou .editar (conferido no service);
// gravar pede .editar (o RLS confere de novo).

const BASE = "/eventos";
const EDITA = { permissao: "comercial.eventos.editar" } as const;

export const rotasDosEventos: FastifyPluginAsyncZod = async (app) => {
  app.get(
    BASE,
    {
      config: { permissao: "comercial.eventos.ver" },
      schema: { response: { 200: respostaEventos } },
    },
    controller.tela,
  );

  app.get(
    `${BASE}/apoio`,
    {
      config: { acesso: "autenticado" },
      schema: { response: { 200: respostaApoioEventos } },
    },
    controller.apoio,
  );

  app.get(
    `${BASE}/feriados`,
    {
      config: { acesso: "autenticado" },
      schema: {
        querystring: consultaFeriadosEventos,
        response: { 200: respostaFeriadosEventos },
      },
    },
    controller.feriados,
  );

  app.get(
    `${BASE}/propostas/:id`,
    {
      config: { acesso: "autenticado" },
      schema: { params: paramsProposta, response: { 200: respostaProposta } },
    },
    controller.proposta,
  );

  app.get(
    `${BASE}/propostas/:id/pdf`,
    { config: { acesso: "autenticado" }, schema: { params: paramsProposta } },
    controller.pdf,
  );

  app.post(
    `${BASE}/propostas`,
    {
      config: EDITA,
      schema: { body: formulario, response: { 201: respostaPropostaCriada } },
    },
    controller.criar,
  );

  app.patch(
    `${BASE}/propostas/:id`,
    {
      config: EDITA,
      schema: {
        params: paramsProposta,
        body: formulario,
        response: { 200: respostaMensagem },
      },
    },
    controller.salvar,
  );

  app.patch(
    `${BASE}/propostas/:id/status`,
    {
      config: EDITA,
      schema: {
        params: paramsProposta,
        body: entradaStatusProposta,
        response: { 200: respostaMensagem },
      },
    },
    controller.mudarStatus,
  );
};
