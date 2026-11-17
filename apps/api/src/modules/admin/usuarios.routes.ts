import {
  entradaCargo,
  entradaNovoUsuario,
  entradaSenha,
  entradaSituacao,
  entradaUsuario,
  parametrosDoId,
  respostaCargos,
  respostaCriado,
  respostaPermissoesDePrograma,
  respostaUsuario,
  respostaUsuarios,
} from "@arp/shared/admin/contratos";
import { respostaMensagem } from "@arp/shared/contratos/auth";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./usuarios.controller";

// Usuários e cargos (prefixo /api/v1/admin). Tudo exige admin.usuarios.

const config = { permissao: "admin.usuarios" } as const;
const mensagem = { 200: respostaMensagem };

export const rotasDeUsuarios: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/usuarios",
    { config, schema: { response: { 200: respostaUsuarios } } },
    controller.listar,
  );
  app.post(
    "/usuarios",
    {
      config,
      schema: { body: entradaNovoUsuario, response: { 201: respostaCriado } },
    },
    controller.criar,
  );
  app.get(
    "/usuarios/:id",
    {
      config,
      schema: { params: parametrosDoId, response: { 200: respostaUsuario } },
    },
    controller.ler,
  );
  app.patch(
    "/usuarios/:id",
    {
      config,
      schema: {
        params: parametrosDoId,
        body: entradaUsuario,
        response: mensagem,
      },
    },
    controller.salvar,
  );
  app.patch(
    "/usuarios/:id/situacao",
    {
      config,
      schema: {
        params: parametrosDoId,
        body: entradaSituacao,
        response: mensagem,
      },
    },
    controller.alternar,
  );
  app.post(
    "/usuarios/:id/senha",
    {
      config,
      schema: {
        params: parametrosDoId,
        body: entradaSenha,
        response: mensagem,
      },
    },
    controller.trocarSenha,
  );
  app.delete(
    "/usuarios/:id/permissoes",
    { config, schema: { params: parametrosDoId, response: mensagem } },
    controller.removerIndividuais,
  );
  app.delete(
    "/usuarios/:id",
    { config, schema: { params: parametrosDoId, response: mensagem } },
    controller.excluir,
  );

  app.get(
    "/cargos",
    { config, schema: { response: { 200: respostaCargos } } },
    controller.listarCargos,
  );
  app.get(
    "/permissoes-de-programa",
    { config, schema: { response: { 200: respostaPermissoesDePrograma } } },
    controller.listarPermissoesDePrograma,
  );
  app.post(
    "/cargos",
    {
      config,
      schema: { body: entradaCargo, response: { 201: respostaCriado } },
    },
    controller.criarCargo,
  );
  app.patch(
    "/cargos/:id",
    {
      config,
      schema: {
        params: parametrosDoId,
        body: entradaCargo,
        response: mensagem,
      },
    },
    controller.salvarCargo,
  );
  app.patch(
    "/cargos/:id/situacao",
    {
      config,
      schema: {
        params: parametrosDoId,
        body: entradaSituacao,
        response: mensagem,
      },
    },
    controller.alternarCargo,
  );
  app.delete(
    "/cargos/:id",
    { config, schema: { params: parametrosDoId, response: mensagem } },
    controller.apagarCargo,
  );
};
