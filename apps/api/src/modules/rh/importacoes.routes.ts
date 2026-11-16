import { respostaMensagem } from "@arp/shared/contratos/auth";
import { corpoDoFormulario } from "@arp/shared/rh/contratos/cadastros";
import {
  entradaConfirmarFolha,
  entradaConfirmarPlano,
  previaDaFolha,
  previaDoPlano,
  respostaFolhaParaEditar,
  respostaImportacoes,
} from "@arp/shared/rh/contratos/importacoes";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as controller from "./importacoes.controller";

// Configurações › Importações: folha (rh.folha) e tabela do plano
// (rh.beneficios). A tela e a classificação de rubrica abrem com mais de uma
// permissão: o service confere. Os envios são multipart (o arquivo).

const FOLHA = { permissao: "rh.folha" } as const;
const BENEFICIOS = { permissao: "rh.beneficios" } as const;
const mensagem = { 200: respostaMensagem };
const comId = z.object({ id: z.string().max(36) });

export const rotasDasImportacoes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/importacoes",
    {
      config: { acesso: "autenticado" },
      schema: { response: { 200: respostaImportacoes } },
    },
    controller.importacoes,
  );

  app.post(
    "/folhas/previa",
    { config: FOLHA, schema: { response: { 200: previaDaFolha } } },
    controller.lerFolha,
  );

  app.post(
    "/folhas/confirmar",
    {
      config: FOLHA,
      schema: { body: entradaConfirmarFolha, response: mensagem },
    },
    controller.confirmarFolha,
  );

  app.delete(
    "/folhas/:id",
    { config: FOLHA, schema: { params: comId, response: mensagem } },
    controller.excluirFolha,
  );

  app.get(
    "/folhas/:id",
    {
      config: FOLHA,
      schema: { params: comId, response: { 200: respostaFolhaParaEditar } },
    },
    controller.folhaParaEditar,
  );

  app.patch(
    "/folhas/:id/pessoas/:colaborador",
    {
      config: FOLHA,
      schema: {
        params: z.object({ id: z.uuid(), colaborador: z.uuid() }),
        body: corpoDoFormulario,
        response: mensagem,
      },
    },
    controller.salvarPessoaDaFolha,
  );

  app.post(
    "/rubricas/classificar",
    {
      config: { acesso: "autenticado" },
      schema: { body: corpoDoFormulario, response: mensagem },
    },
    controller.classificarRubrica,
  );

  app.post(
    "/planos/previa",
    { config: BENEFICIOS, schema: { response: { 200: previaDoPlano } } },
    controller.lerTabelaPlano,
  );

  app.post(
    "/planos/confirmar",
    {
      config: BENEFICIOS,
      schema: { body: entradaConfirmarPlano, response: mensagem },
    },
    controller.confirmarTabelaPlano,
  );

  app.patch(
    "/planos/tabelas/:id/faixas",
    {
      config: BENEFICIOS,
      schema: { params: comId, body: corpoDoFormulario, response: mensagem },
    },
    controller.salvarFaixasPlano,
  );
};
