import {
  consultaDoPeriodo,
  pedidoDaMemoria,
  pedidoDoQuadro,
  respostaTabelas,
} from "@arp/shared/rh/contratos/comum";
import { respostaParametros } from "@arp/shared/rh/contratos/parametros";
import {
  respostaJornada,
  respostaPainel,
  respostaQuadro,
} from "@arp/shared/rh/contratos/telas";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./telas.controller";

// Leituras das telas do RH que só mostram: Painel, Quadro e turnover,
// Jornada, Parâmetros (leitura) e as tabelas dos modais pedidas ao abrir.
// Cada rota pede a mesma permissão que abria a tela.

export const rotasDasTelas: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/painel",
    {
      config: { permissao: "rh.painel" },
      schema: {
        querystring: consultaDoPeriodo,
        response: { 200: respostaPainel },
      },
    },
    controller.painel,
  );

  app.get(
    "/quadro",
    {
      config: { permissao: "rh.quadro" },
      schema: {
        querystring: consultaDoPeriodo,
        response: { 200: respostaQuadro },
      },
    },
    controller.quadro,
  );

  app.get(
    "/jornada",
    {
      config: { permissao: "rh.jornada" },
      schema: {
        querystring: consultaDoPeriodo,
        response: { 200: respostaJornada },
      },
    },
    controller.jornada,
  );

  app.get(
    "/parametros",
    {
      config: { permissao: "rh.parametros" },
      schema: { response: { 200: respostaParametros } },
    },
    controller.parametros,
  );

  // A lista de pessoas só sai para quem vê o quadro (a regra das telas).
  app.get(
    "/detalhes/quadro",
    {
      config: { permissao: "rh.quadro" },
      schema: {
        querystring: pedidoDoQuadro,
        response: { 200: respostaTabelas },
      },
    },
    controller.tabelasDoQuadro,
  );

  app.get(
    "/detalhes/memoria-do-custo",
    {
      config: { permissao: "rh.custo_pessoal.individual" },
      schema: {
        querystring: pedidoDaMemoria,
        response: { 200: respostaTabelas },
      },
    },
    controller.tabelasDaMemoria,
  );
};
