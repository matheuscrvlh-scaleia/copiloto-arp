import {
  respostaLinkDeEnvio,
  respostaMensagem,
} from "@arp/shared/operacoes/contratos/base";
import {
  entradaAnexo,
  entradaConfirmarHistorico,
  entradaCriarMes,
  entradaEnvioDeAnexo,
  entradaEnvioDoHistorico,
  entradaLancamento,
  entradaPreviaDoHistorico,
  entradaReabrir,
  respostaCriarMes,
  respostaLinkDoAnexo,
  respostaMesAnterior,
  respostaMesDoRateio,
  respostaMesesDoRateio,
  respostaPreviaAbertaDoHistorico,
  respostaPreviaDoHistorico,
} from "@arp/shared/operacoes/contratos/limpeza";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as controller from "./limpeza.controller";

// Rateio da limpeza (prefixo /api/v1/operacoes/limpeza). Leitura: quem vê o
// rateio (o service confere; o RLS de novo). Gravação: quem lança
// (operacoes.limpeza.fechar); o banco confere de novo e deixa mudar só o mês
// aberto. PDF e Excel: também o Financeiro, só o mês enviado (o service
// confere).

const comMes = z.object({ mes: z.string().max(10) });
const comId = z.object({ id: z.uuid("Anexo inválido.") });
const comImportacao = z.object({ id: z.uuid("Importação inválida.") });

export const rotasDaLimpeza: FastifyPluginAsyncZod = async (app) => {
  const autenticado = { acesso: "autenticado" } as const;
  const lancar = { permissao: "operacoes.limpeza.fechar" } as const;

  app.get(
    "/meses",
    {
      config: autenticado,
      schema: { response: { 200: respostaMesesDoRateio } },
    },
    controller.meses,
  );

  app.get(
    "/meses/:mes",
    {
      config: autenticado,
      schema: { params: comMes, response: { 200: respostaMesDoRateio } },
    },
    controller.mes,
  );

  app.get(
    "/meses/:mes/demonstrativo",
    {
      config: autenticado,
      schema: {
        params: comMes,
        querystring: z.object({ bloco: z.string().max(4).optional() }),
      },
    },
    controller.demonstrativo,
  );

  app.get(
    "/meses/:mes/planilha",
    { config: autenticado, schema: { params: comMes } },
    controller.planilha,
  );

  app.get(
    "/meses/:mes/anterior",
    {
      config: lancar,
      schema: { params: comMes, response: { 200: respostaMesAnterior } },
    },
    controller.mesAnterior,
  );

  app.post(
    "/meses",
    {
      config: lancar,
      schema: { body: entradaCriarMes, response: { 200: respostaCriarMes } },
    },
    controller.criarMes,
  );

  app.put(
    "/meses/:mes",
    {
      config: lancar,
      schema: {
        params: comMes,
        body: entradaLancamento,
        response: { 200: respostaMensagem },
      },
    },
    controller.salvar,
  );

  app.post(
    "/meses/:mes/fechar",
    {
      config: lancar,
      schema: { params: comMes, response: { 200: respostaMensagem } },
    },
    controller.fechar,
  );

  app.post(
    "/meses/:mes/reabrir",
    {
      config: lancar,
      schema: {
        params: comMes,
        body: entradaReabrir,
        response: { 200: respostaMensagem },
      },
    },
    controller.reabrir,
  );

  app.post(
    "/meses/:mes/enviar",
    {
      config: lancar,
      schema: { params: comMes, response: { 200: respostaMensagem } },
    },
    controller.enviar,
  );

  app.post(
    "/meses/:mes/anexos/envio",
    {
      config: lancar,
      schema: {
        params: comMes,
        body: entradaEnvioDeAnexo,
        response: { 200: respostaLinkDeEnvio },
      },
    },
    controller.prepararAnexo,
  );

  app.post(
    "/meses/:mes/anexos",
    {
      config: lancar,
      schema: {
        params: comMes,
        body: entradaAnexo,
        response: { 200: respostaMensagem },
      },
    },
    controller.registrarAnexo,
  );

  app.delete(
    "/anexos/:id",
    {
      config: lancar,
      schema: { params: comId, response: { 200: respostaMensagem } },
    },
    controller.removerAnexo,
  );

  app.get(
    "/anexos/:id/link",
    {
      config: autenticado,
      schema: { params: comId, response: { 200: respostaLinkDoAnexo } },
    },
    controller.linkDoAnexo,
  );

  app.post(
    "/historico/envio",
    {
      config: lancar,
      schema: {
        body: entradaEnvioDoHistorico,
        response: { 200: respostaLinkDeEnvio },
      },
    },
    controller.prepararHistorico,
  );

  app.post(
    "/historico/previa",
    {
      config: lancar,
      schema: {
        body: entradaPreviaDoHistorico,
        response: { 200: respostaPreviaDoHistorico },
      },
    },
    controller.previaHistorico,
  );

  app.get(
    "/historico/previa-aberta",
    {
      config: autenticado,
      schema: { response: { 200: respostaPreviaAbertaDoHistorico } },
    },
    controller.previaAbertaHistorico,
  );

  app.post(
    "/historico/:id/confirmar",
    {
      config: lancar,
      schema: {
        params: comImportacao,
        body: entradaConfirmarHistorico,
        response: { 200: respostaMensagem },
      },
    },
    controller.confirmarHistorico,
  );

  app.post(
    "/historico/:id/descartar",
    {
      config: lancar,
      schema: { params: comImportacao, response: { 200: respostaMensagem } },
    },
    controller.descartarHistorico,
  );
};
