import {
  ativoParaEditar,
  consultaAtivos,
  consultaEtiquetas,
  entradaEtiquetas,
  fichaDoAtivo,
  idDoRegistro,
  opcoesDoCadastro,
  respostaAtivoSalvo,
  respostaAtivos,
  respostaCategoriasDeAtivo,
  respostaEtiquetas,
  respostaSaidaRegistrada,
  respostaSaidas,
} from "@arp/shared/os/contratos/ativos";
import { respostaMensagem } from "@arp/shared/os/contratos/base";
import { planilha } from "@arp/shared/os/contratos/visoes";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as controller from "./ativos.controller";

// /api/v1/os/ativos: lista, decisão de troca, ficha, cadastro, planos
// preventivos, anexos, categorias, etiquetas e saídas. A tela abre com
// os.ativos OU os.ativos_gerenciar (e as saídas também com
// os.ativos_saida): a rota pede a sessão e o service confere, com as
// mesmas mensagens de antes. Os formulários são validados no controller
// (rótulo do campo na mensagem).

const ACESSO = { acesso: "autenticado" } as const;
const comMensagem = { 200: respostaMensagem };
/** Formulário validado no controller com o schema do contrato. */
const corpo = z.looseObject({});

export const rotasDeAtivos: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/ativos",
    {
      config: ACESSO,
      schema: {
        querystring: consultaAtivos,
        response: { 200: respostaAtivos },
      },
    },
    controller.lista,
  );

  app.get(
    "/ativos/exportacao",
    {
      config: ACESSO,
      schema: { querystring: consultaAtivos, response: { 200: planilha } },
    },
    controller.exportar,
  );

  app.get(
    "/ativos/opcoes",
    { config: ACESSO, schema: { response: { 200: opcoesDoCadastro } } },
    controller.opcoes,
  );

  // Formulário com foto (multipart): o controller valida os campos.
  app.post(
    "/ativos",
    { config: ACESSO, schema: { response: { 200: respostaAtivoSalvo } } },
    controller.salvar,
  );

  app.get(
    "/ativos/etiquetas",
    { config: ACESSO, schema: { response: { 200: respostaEtiquetas } } },
    controller.etiquetas,
  );

  // PDF: GET (?id=…&id=…) para uma ou poucas; POST para lotes grandes.
  app.get(
    "/ativos/etiquetas/pdf",
    { config: ACESSO, schema: { querystring: consultaEtiquetas } },
    controller.etiquetasPdf,
  );

  app.post(
    "/ativos/etiquetas/pdf",
    { config: ACESSO, schema: { body: entradaEtiquetas } },
    controller.etiquetasPdfEmLote,
  );

  app.get(
    "/ativos/categorias",
    {
      config: ACESSO,
      schema: { response: { 200: respostaCategoriasDeAtivo } },
    },
    controller.categorias,
  );

  app.post(
    "/ativos/categorias",
    { config: ACESSO, schema: { body: corpo, response: comMensagem } },
    controller.salvarCategoria,
  );

  app.delete(
    "/ativos/categorias/:id",
    { config: ACESSO, schema: { params: idDoRegistro, response: comMensagem } },
    controller.excluirCategoria,
  );

  app.post(
    "/ativos/planos",
    { config: ACESSO, schema: { body: corpo, response: comMensagem } },
    controller.salvarPlano,
  );

  app.post(
    "/ativos/planos/:id/alternar",
    {
      config: ACESSO,
      schema: { params: idDoRegistro, body: corpo, response: comMensagem },
    },
    controller.alternarPlano,
  );

  app.post(
    "/ativos/planos/:id/gerar",
    { config: ACESSO, schema: { params: idDoRegistro, response: comMensagem } },
    controller.gerarPreventiva,
  );

  app.delete(
    "/ativos/planos/:id",
    { config: ACESSO, schema: { params: idDoRegistro, response: comMensagem } },
    controller.excluirPlano,
  );

  app.delete(
    "/ativos/anexos/:id",
    { config: ACESSO, schema: { params: idDoRegistro, response: comMensagem } },
    controller.removerAnexo,
  );

  app.get(
    "/ativos/saidas",
    {
      config: ACESSO,
      schema: {
        querystring: consultaAtivos,
        response: { 200: respostaSaidas },
      },
    },
    controller.relatorioDeSaidas,
  );

  // Multipart (anexos): o controller valida os campos.
  app.post(
    "/ativos/saidas",
    {
      config: ACESSO,
      schema: { response: { 200: respostaSaidaRegistrada } },
    },
    controller.registrarSaida,
  );

  app.get(
    "/ativos/saidas/:id/recibo",
    { config: ACESSO, schema: { params: idDoRegistro } },
    controller.recibo,
  );

  app.post(
    "/ativos/saidas/:id/desfazer",
    {
      config: ACESSO,
      schema: { params: idDoRegistro, body: corpo, response: comMensagem },
    },
    controller.desfazerSaida,
  );

  app.get(
    "/ativos/:id",
    {
      config: ACESSO,
      schema: { params: idDoRegistro, response: { 200: fichaDoAtivo } },
    },
    controller.ficha,
  );

  app.get(
    "/ativos/:id/edicao",
    {
      config: ACESSO,
      schema: { params: idDoRegistro, response: { 200: ativoParaEditar } },
    },
    controller.edicao,
  );

  app.post(
    "/ativos/:id/situacao",
    {
      config: ACESSO,
      schema: { params: idDoRegistro, body: corpo, response: comMensagem },
    },
    controller.situacao,
  );

  app.post(
    "/ativos/:id/baixa",
    {
      config: ACESSO,
      schema: { params: idDoRegistro, body: corpo, response: comMensagem },
    },
    controller.baixa,
  );

  // Multipart (categoria e arquivo).
  app.post(
    "/ativos/:id/anexos",
    { config: ACESSO, schema: { params: idDoRegistro, response: comMensagem } },
    controller.anexar,
  );
};
