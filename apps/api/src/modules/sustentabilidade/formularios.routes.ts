import {
  consultaDosFormularios,
  entradaAlterarFormulario,
  entradaAlterarRascunho,
  entradaCriarFormulario,
  entradaPublicar,
  entradaRestaurar,
  entradaVersaoOtimista,
  idDoFormulario,
  respostaEditor,
  respostaEditorDados,
  respostaFormulario,
  respostaFormulariosDoPrograma,
  respostaQuestionario,
  respostaVersao,
} from "@arp/shared/sustentabilidade/contratos/formularios";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as controller from "./formularios.controller";

// Formulários específicos (prefixo /api/v1/sustentabilidade/formularios): o
// editor do questionário da entrevista e dos formulários dos programas, e a
// lista de formulários de um programa. A permissão depende do tipo do
// formulário ("Entrevistas – editar questionário" ou "Programas –
// gerenciar"), por isso a rota é "autenticado" e o service confere no banco,
// formulário a formulário; o RLS confere de novo.
//
// As gravações respondem sempre 200 com `{ ok }` ou `{ erro, ... }`, como as
// ações antigas: a tela usa `podeInativar` e a lista `erros` que vêm junto
// com o erro.

const config = { acesso: "autenticado" } as const;
const params = idDoFormulario;

export const rotasDosFormularios: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/formularios/questionario",
    { config, schema: { response: { 200: respostaQuestionario } } },
    controller.questionario,
  );
  app.get(
    "/formularios",
    {
      config,
      schema: {
        querystring: consultaDosFormularios,
        response: { 200: respostaFormulariosDoPrograma },
      },
    },
    controller.doPrograma,
  );
  app.get(
    "/formularios/:id/editor",
    { config, schema: { params, response: { 200: respostaEditorDados } } },
    controller.editor,
  );
  app.get(
    "/formularios/:id/versoes/:versao",
    {
      config,
      schema: {
        params: params.extend({ versao: z.coerce.number() }),
        response: { 200: respostaVersao },
      },
    },
    controller.versao,
  );
  app.post(
    "/formularios/:id/rascunho",
    {
      config,
      schema: {
        params,
        body: entradaAlterarRascunho,
        response: { 200: respostaEditor },
      },
    },
    controller.alterarRascunho,
  );
  app.post(
    "/formularios/:id/rascunho/descartar",
    {
      config,
      schema: {
        params,
        body: entradaVersaoOtimista,
        response: { 200: respostaEditor },
      },
    },
    controller.descartarRascunho,
  );
  app.post(
    "/formularios/:id/rascunho/restaurar",
    {
      config,
      schema: {
        params,
        body: entradaRestaurar,
        response: { 200: respostaEditor },
      },
    },
    controller.restaurar,
  );
  app.post(
    "/formularios/:id/publicar",
    {
      config,
      schema: {
        params,
        body: entradaPublicar,
        response: { 200: respostaEditor },
      },
    },
    controller.publicar,
  );
  app.post(
    "/formularios",
    {
      config,
      schema: {
        body: entradaCriarFormulario,
        response: { 200: respostaFormulario },
      },
    },
    controller.criar,
  );
  app.patch(
    "/formularios/:id",
    {
      config,
      schema: {
        params,
        body: entradaAlterarFormulario,
        response: { 200: respostaFormulario },
      },
    },
    controller.alterar,
  );
  app.post(
    "/formularios/:id/duplicar",
    { config, schema: { params, response: { 200: respostaFormulario } } },
    controller.duplicar,
  );
  app.delete(
    "/formularios/:id",
    { config, schema: { params, response: { 200: respostaFormulario } } },
    controller.excluir,
  );
};
