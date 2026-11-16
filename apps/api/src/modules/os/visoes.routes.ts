import { respostaMensagem } from "@arp/shared/os/contratos/base";
import { idDoChamado } from "@arp/shared/os/contratos/chamados";
import {
  consultaDaLista,
  consultaDoQuadro,
  consultaLivre,
  entradaAtribuir,
  entradaMover,
  entradaPrazo,
  entradaPrioridade,
  entradaReabrir,
  planilha,
  respostaCalendario,
  respostaLista,
  respostaQuadro,
  respostaSeuDia,
} from "@arp/shared/os/contratos/visoes";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./visoes.controller";

// /api/v1/os/visoes: Minha caixa, Geral, Avisos, Quadro e Calendário (e as
// mesmas telas das OS), mais as ações rápidas da linha e do quadro. As
// leituras recebem os parâmetros da URL da tela como vieram: quem os lê é a
// regra pura de @arp/shared/os/lista, igual na tela.

const ACESSO = { permissao: "os.acessar" } as const;
const comMensagem = { 200: respostaMensagem };

export const rotasDeVisoes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/visoes/lista",
    {
      config: ACESSO,
      schema: {
        querystring: consultaDaLista,
        response: { 200: respostaLista },
      },
    },
    controller.lista,
  );

  app.get(
    "/visoes/lista/exportacao",
    {
      config: ACESSO,
      schema: { querystring: consultaDaLista, response: { 200: planilha } },
    },
    controller.exportarLista,
  );

  app.get(
    "/visoes/quadro",
    {
      config: ACESSO,
      schema: {
        querystring: consultaDoQuadro,
        response: { 200: respostaQuadro },
      },
    },
    controller.quadro,
  );

  app.get(
    "/visoes/quadro/exportacao",
    {
      config: ACESSO,
      schema: { querystring: consultaDoQuadro, response: { 200: planilha } },
    },
    controller.exportarQuadro,
  );

  app.get(
    "/visoes/calendario",
    {
      config: ACESSO,
      schema: {
        querystring: consultaLivre,
        response: { 200: respostaCalendario },
      },
    },
    controller.calendario,
  );

  app.get(
    "/visoes/seu-dia",
    { config: ACESSO, schema: { response: { 200: respostaSeuDia } } },
    controller.seuDia,
  );

  app.post(
    "/chamados/lote/responsavel",
    {
      config: ACESSO,
      schema: { body: entradaAtribuir, response: comMensagem },
    },
    controller.atribuir,
  );

  app.post(
    "/chamados/lote/prazo",
    { config: ACESSO, schema: { body: entradaPrazo, response: comMensagem } },
    controller.prazo,
  );

  app.post(
    "/chamados/lote/prioridade",
    {
      config: ACESSO,
      schema: { body: entradaPrioridade, response: comMensagem },
    },
    controller.prioridade,
  );

  app.post(
    "/chamados/:id/confirmar",
    { config: ACESSO, schema: { params: idDoChamado, response: comMensagem } },
    controller.confirmar,
  );

  app.post(
    "/chamados/:id/reabrir",
    {
      config: ACESSO,
      schema: {
        params: idDoChamado,
        body: entradaReabrir,
        response: comMensagem,
      },
    },
    controller.reabrir,
  );

  app.post(
    "/chamados/:id/mover",
    {
      config: ACESSO,
      schema: {
        params: idDoChamado,
        body: entradaMover,
        response: comMensagem,
      },
    },
    controller.mover,
  );
};
