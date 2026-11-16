import { respostaMensagem } from "@arp/shared/comercial/contratos/base";
import { formulario } from "@arp/shared/comercial/contratos/configuracoes";
import {
  paramsImovel,
  respostaApoioPesquisa,
  respostaImovel,
  respostaImovelCriado,
  respostaPesquisa,
} from "@arp/shared/comercial/contratos/pesquisa";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./pesquisa.controller";

// Pesquisa de mercado. Contrato: @arp/shared/comercial/contratos/pesquisa.
// Tela e detalhe abrem com pesquisa.ver; cadastro e correção pedem .editar
// (o RLS confere de novo). Bairros e tipos são configuração do módulo.

const BASE = "/pesquisa";

export const rotasDaPesquisa: FastifyPluginAsyncZod = async (app) => {
  app.get(
    BASE,
    {
      config: { permissao: "comercial.pesquisa.ver" },
      schema: { response: { 200: respostaPesquisa } },
    },
    controller.tela,
  );

  app.get(
    `${BASE}/apoio`,
    {
      config: { acesso: "autenticado" },
      schema: { response: { 200: respostaApoioPesquisa } },
    },
    controller.apoio,
  );

  app.get(
    `${BASE}/imoveis/:id`,
    {
      config: { permissao: "comercial.pesquisa.ver" },
      schema: { params: paramsImovel, response: { 200: respostaImovel } },
    },
    controller.imovel,
  );

  app.post(
    `${BASE}/imoveis`,
    {
      config: { permissao: "comercial.pesquisa.editar" },
      schema: { body: formulario, response: { 201: respostaImovelCriado } },
    },
    controller.cadastrar,
  );

  app.patch(
    `${BASE}/imoveis/:id`,
    {
      config: { permissao: "comercial.pesquisa.editar" },
      schema: {
        params: paramsImovel,
        body: formulario,
        response: { 200: respostaMensagem },
      },
    },
    controller.corrigir,
  );
};
