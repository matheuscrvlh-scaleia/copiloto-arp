import { respostaMensagem } from "@arp/shared/comercial/contratos/base";
import {
  consultaAniversarios,
  consultaContatos,
  entradaContato,
  paramsContato,
  respostaAniversarios,
  respostaConfigRelacionamento,
  respostaContato,
  respostaContatos,
  respostaLocatarios,
} from "@arp/shared/comercial/contratos/relacionamento";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./relacionamento.controller";

// Relacionamento. Contrato: @arp/shared/comercial/contratos/relacionamento.
// Configuração e locatários servem a quem registra contato de outras telas
// (detalhe do contrato em Vencimentos): pedem só acesso ao módulo.

const BASE = "/relacionamento";

export const rotasDoRelacionamento: FastifyPluginAsyncZod = async (app) => {
  app.get(
    `${BASE}/config`,
    {
      config: { acesso: "autenticado" },
      schema: { response: { 200: respostaConfigRelacionamento } },
    },
    controller.config,
  );

  app.get(
    `${BASE}/locatarios`,
    {
      config: { acesso: "autenticado" },
      schema: { response: { 200: respostaLocatarios } },
    },
    controller.locatarios,
  );

  app.get(
    `${BASE}/aniversarios`,
    {
      config: { permissao: "comercial.relacionamento.ver" },
      schema: {
        querystring: consultaAniversarios,
        response: { 200: respostaAniversarios },
      },
    },
    controller.aniversarios,
  );

  app.get(
    `${BASE}/contatos`,
    {
      config: { permissao: "comercial.relacionamento.ver" },
      schema: {
        querystring: consultaContatos,
        response: { 200: respostaContatos },
      },
    },
    controller.contatos,
  );

  app.get(
    `${BASE}/contatos/:id`,
    {
      config: { permissao: "comercial.relacionamento.ver" },
      schema: { params: paramsContato, response: { 200: respostaContato } },
    },
    controller.contato,
  );

  app.post(
    `${BASE}/sac/sincronizar`,
    {
      config: { permissao: "comercial.relacionamento.registrar" },
      schema: { response: { 200: respostaMensagem } },
    },
    controller.sac,
  );

  app.post(
    `${BASE}/contatos`,
    {
      config: { permissao: "comercial.relacionamento.registrar" },
      schema: { body: entradaContato, response: { 201: respostaMensagem } },
    },
    controller.registrar,
  );

  app.patch(
    `${BASE}/contatos/:id`,
    {
      config: { permissao: "comercial.relacionamento.registrar" },
      schema: {
        params: paramsContato,
        body: entradaContato,
        response: { 200: respostaMensagem },
      },
    },
    controller.editar,
  );

  app.delete(
    `${BASE}/contatos/:id`,
    {
      config: { permissao: "comercial.relacionamento.registrar" },
      schema: { params: paramsContato, response: { 200: respostaMensagem } },
    },
    controller.excluir,
  );
};
