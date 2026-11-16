import { respostaMensagem } from "@arp/shared/contratos/auth";
import {
  entradaNovo,
  entradaSituacao,
  formulario,
  parametroFormulario,
  respostaCriado,
  respostaLista,
} from "@arp/shared/formularios/contratos";
import {
  aparenciaSchema,
  configuracoesSchema,
  conteudoSchema,
} from "@arp/shared/formularios/formulario";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./relatorios.controller";

// /api/v1/relatorios: os relatórios em si. As telas abrem com
// formularios.ver ou formularios.editar e as gravações pedem
// formularios.editar; como são duas permissões (e a mensagem de "sem
// permissão" é a do sistema anterior), quem confere é o service, e o RLS
// de novo.

const comId = { params: parametroFormulario };
const salvo = { 200: respostaMensagem };

export const rotasDosRelatorios: FastifyPluginAsyncZod = async (app) => {
  const logado = { acesso: "autenticado" } as const;

  app.get(
    "/",
    { config: logado, schema: { response: { 200: respostaLista } } },
    controller.listar,
  );

  app.post(
    "/",
    {
      config: logado,
      schema: { body: entradaNovo, response: { 201: respostaCriado } },
    },
    controller.criar,
  );

  app.get(
    "/:id",
    { config: logado, schema: { ...comId, response: { 200: formulario } } },
    controller.obter,
  );

  app.patch(
    "/:id/conteudo",
    {
      config: logado,
      schema: { ...comId, body: conteudoSchema, response: salvo },
    },
    controller.salvarConteudo,
  );

  app.patch(
    "/:id/configuracoes",
    {
      config: logado,
      schema: { ...comId, body: configuracoesSchema, response: salvo },
    },
    controller.salvarConfiguracoes,
  );

  app.patch(
    "/:id/aparencia",
    {
      config: logado,
      schema: { ...comId, body: aparenciaSchema, response: salvo },
    },
    controller.salvarAparencia,
  );

  app.post(
    "/:id/situacao",
    {
      config: logado,
      schema: { ...comId, body: entradaSituacao, response: salvo },
    },
    controller.mudarSituacao,
  );

  app.post(
    "/:id/novo-link",
    { config: logado, schema: { ...comId, response: salvo } },
    controller.gerarNovoLink,
  );

  app.post(
    "/:id/duplicar",
    { config: logado, schema: { ...comId, response: { 201: respostaCriado } } },
    controller.duplicar,
  );

  app.delete(
    "/:id",
    { config: logado, schema: { ...comId, response: salvo } },
    controller.excluir,
  );
};
