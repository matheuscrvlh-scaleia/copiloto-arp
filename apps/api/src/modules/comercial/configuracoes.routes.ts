import { respostaMensagem } from "@arp/shared/comercial/contratos/base";
import {
  consultaDePara,
  consultaHistorico,
  formulario,
  paramsFaixa,
  paramsFeriado,
  paramsLista,
  respostaBlocoEventos,
  respostaBlocoFunil,
  respostaBlocoOcupacao,
  respostaCalendario,
  respostaHistorico,
  respostaParametros,
} from "@arp/shared/comercial/contratos/configuracoes";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./configuracoes.controller";

// Comercial › Configurações (Parâmetros e Histórico). Contrato:
// @arp/shared/comercial/contratos/configuracoes.

const BASE = "/configuracoes";
const EDITA = { permissao: "comercial.parametros.editar" } as const;
const MENSAGEM = { 200: respostaMensagem };

export const rotasDeConfiguracoes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    `${BASE}/parametros`,
    { config: EDITA, schema: { response: { 200: respostaParametros } } },
    controller.parametros,
  );
  app.get(
    `${BASE}/parametros/funil`,
    { config: EDITA, schema: { response: { 200: respostaBlocoFunil } } },
    controller.blocoFunil,
  );
  app.get(
    `${BASE}/parametros/ocupacao`,
    { config: EDITA, schema: { response: { 200: respostaBlocoOcupacao } } },
    controller.blocoOcupacao,
  );
  app.get(
    `${BASE}/parametros/eventos`,
    { config: EDITA, schema: { response: { 200: respostaBlocoEventos } } },
    controller.blocoEventos,
  );
  app.get(
    `${BASE}/parametros/calendario`,
    { config: EDITA, schema: { response: { 200: respostaCalendario } } },
    controller.calendario,
  );
  app.get(
    `${BASE}/historico`,
    {
      config: EDITA,
      schema: {
        querystring: consultaHistorico,
        response: { 200: respostaHistorico },
      },
    },
    controller.historico,
  );

  app.put(
    `${BASE}/parametros`,
    { config: EDITA, schema: { body: formulario, response: MENSAGEM } },
    controller.salvarParametros,
  );
  app.put(
    `${BASE}/listas/:lista`,
    {
      config: EDITA,
      schema: { params: paramsLista, body: formulario, response: MENSAGEM },
    },
    controller.salvarLista,
  );
  app.put(
    `${BASE}/de-para`,
    { config: EDITA, schema: { body: formulario, response: MENSAGEM } },
    controller.salvarDePara,
  );
  app.post(
    `${BASE}/de-para`,
    { config: EDITA, schema: { body: formulario, response: MENSAGEM } },
    controller.incluirFonteDePara,
  );
  app.delete(
    `${BASE}/de-para`,
    {
      config: EDITA,
      schema: { querystring: consultaDePara, response: MENSAGEM },
    },
    controller.removerFonteDePara,
  );
  app.put(
    `${BASE}/tipos-luc`,
    { config: EDITA, schema: { body: formulario, response: MENSAGEM } },
    controller.salvarTiposLuc,
  );
  app.post(
    `${BASE}/tipos-luc`,
    { config: EDITA, schema: { body: formulario, response: MENSAGEM } },
    controller.incluirTipoLuc,
  );
  app.put(
    `${BASE}/faixas-evento`,
    { config: EDITA, schema: { body: formulario, response: MENSAGEM } },
    controller.salvarFaixaEvento,
  );
  app.delete(
    `${BASE}/faixas-evento/:id`,
    { config: EDITA, schema: { params: paramsFaixa, response: MENSAGEM } },
    controller.removerFaixaEvento,
  );
  app.post(
    `${BASE}/feriados`,
    { config: EDITA, schema: { body: formulario, response: MENSAGEM } },
    controller.incluirFeriado,
  );
  app.delete(
    `${BASE}/feriados/:data`,
    { config: EDITA, schema: { params: paramsFeriado, response: MENSAGEM } },
    controller.removerFeriado,
  );
};
