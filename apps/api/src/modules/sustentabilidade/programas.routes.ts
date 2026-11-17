import { respostaMensagem } from "@arp/shared/contratos/auth";
import {
  entradaCorrecao,
  entradaLancamento,
  idDoLancamento,
  respostaCorrecao,
  respostaLancamentos,
} from "@arp/shared/sustentabilidade/contratos/lancamentos";
import {
  consultaDoMes,
  entradaIndicador,
  entradaPrograma,
  entradaSituacao,
  idDoIndicador,
  idDoIndicadorDoPrograma,
  idDoPrograma,
  respostaIndicadores,
  respostaLinkGerado,
  respostaLinks,
  respostaPrograma,
  respostaProgramaCriado,
  respostaProgramas,
  respostaResumo,
} from "@arp/shared/sustentabilidade/contratos/programas";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./programas.controller";

// /api/v1/sustentabilidade/programas e /lancamentos (spec 4.8). Ler e
// lançar: quem gerencia os programas ou tem "Programa – lançar" do
// programa (permissão dinâmica, conferida no service; por isso a rota é só
// "autenticado"). Cadastro, indicadores e link do parceiro: "Programas –
// gerenciar" (e o RLS de novo).

const LANCA = { acesso: "autenticado" } as const;
const GERENCIA = { permissao: "sustentabilidade.programas.gerenciar" } as const;
const comMensagem = { 200: respostaMensagem };

export const rotasDeProgramas: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/programas",
    {
      config: LANCA,
      schema: {
        querystring: consultaDoMes,
        response: { 200: respostaProgramas },
      },
    },
    controller.listar,
  );

  app.post(
    "/programas",
    {
      config: GERENCIA,
      schema: {
        body: entradaPrograma,
        response: { 201: respostaProgramaCriado },
      },
    },
    controller.criar,
  );

  app.get(
    "/programas/:id",
    {
      config: LANCA,
      schema: { params: idDoPrograma, response: { 200: respostaPrograma } },
    },
    controller.obter,
  );

  app.patch(
    "/programas/:id",
    {
      config: GERENCIA,
      schema: {
        params: idDoPrograma,
        body: entradaPrograma,
        response: comMensagem,
      },
    },
    controller.atualizar,
  );

  app.patch(
    "/programas/:id/situacao",
    {
      config: GERENCIA,
      schema: {
        params: idDoPrograma,
        body: entradaSituacao,
        response: comMensagem,
      },
    },
    controller.situacao,
  );

  app.get(
    "/programas/:id/resumo",
    {
      config: LANCA,
      schema: {
        params: idDoPrograma,
        querystring: consultaDoMes,
        response: { 200: respostaResumo },
      },
    },
    controller.resumo,
  );

  // ---------------------------------------------------------- indicadores

  app.get(
    "/programas/:id/indicadores",
    {
      config: GERENCIA,
      schema: {
        params: idDoPrograma,
        response: { 200: respostaIndicadores },
      },
    },
    controller.indicadores,
  );

  app.post(
    "/programas/:id/indicadores",
    {
      config: GERENCIA,
      schema: {
        params: idDoPrograma,
        body: entradaIndicador,
        response: { 201: respostaMensagem },
      },
    },
    controller.criarIndicador,
  );

  app.patch(
    "/programas/:id/indicadores/:indicadorId",
    {
      config: GERENCIA,
      schema: {
        params: idDoIndicadorDoPrograma,
        body: entradaIndicador,
        response: comMensagem,
      },
    },
    controller.atualizarIndicador,
  );

  app.patch(
    "/indicadores/:id/situacao",
    {
      config: GERENCIA,
      schema: {
        params: idDoIndicador,
        body: entradaSituacao,
        response: comMensagem,
      },
    },
    controller.situacaoDoIndicador,
  );

  // ---------------------------------------------------------- link do parceiro

  app.get(
    "/programas/:id/links",
    {
      config: GERENCIA,
      schema: { params: idDoPrograma, response: { 200: respostaLinks } },
    },
    controller.links,
  );

  app.post(
    "/programas/:id/link",
    {
      config: GERENCIA,
      schema: { params: idDoPrograma, response: { 200: respostaLinkGerado } },
    },
    controller.gerarLink,
  );

  app.delete(
    "/programas/:id/link",
    {
      config: GERENCIA,
      schema: { params: idDoPrograma, response: comMensagem },
    },
    controller.desligarLink,
  );

  // ---------------------------------------------------------- lançamentos

  app.get(
    "/programas/:id/lancamentos",
    {
      config: LANCA,
      schema: {
        params: idDoPrograma,
        querystring: consultaDoMes,
        response: { 200: respostaLancamentos },
      },
    },
    controller.lancamentosDoMes,
  );

  app.post(
    "/programas/:id/lancamentos",
    {
      config: LANCA,
      schema: {
        params: idDoPrograma,
        body: entradaLancamento,
        response: { 201: respostaMensagem },
      },
    },
    controller.lancar,
  );

  app.get(
    "/lancamentos/:id/correcao",
    {
      config: LANCA,
      schema: { params: idDoLancamento, response: { 200: respostaCorrecao } },
    },
    controller.abrirCorrecao,
  );

  app.patch(
    "/lancamentos/:id",
    {
      config: LANCA,
      schema: {
        params: idDoLancamento,
        body: entradaCorrecao,
        response: comMensagem,
      },
    },
    controller.corrigir,
  );

  app.delete(
    "/lancamentos/:id",
    {
      config: LANCA,
      schema: { params: idDoLancamento, response: comMensagem },
    },
    controller.excluir,
  );
};
