import { esquemaConta } from "@arp/shared/operacoes/agua-conta";
import { esquemaLeitura } from "@arp/shared/operacoes/agua-edicao";
import { respostaMensagem } from "@arp/shared/operacoes/contratos/base";
import {
  respostaConfirmarConta,
  respostaImportacao,
  respostaLerConta,
  respostaPaginaDeImportacoes,
  respostaPreviaAbertaConta,
  respostaSituacaoDasImportacoes,
} from "@arp/shared/operacoes/contratos/importacoes";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as controller from "./importacoes.controller";

// Histórico de importações (prefixo /api/v1/operacoes/importacoes): o RLS
// mostra a cada pessoa os tipos que ela vê ou importa; o banco confere a
// permissão do tipo ao desfazer.

const comId = z.object({ id: z.uuid("importação inválida") });
const buscaDoHistorico = z.object({
  log_tipo: z.string().max(20).optional(),
  status: z.string().max(20).optional(),
  de: z.string().max(10).optional(),
  ate: z.string().max(10).optional(),
  pagina: z.string().max(6).optional(),
});

export const rotasDasImportacoes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/",
    {
      config: { acesso: "autenticado" },
      schema: {
        querystring: buscaDoHistorico,
        response: { 200: respostaPaginaDeImportacoes },
      },
    },
    controller.pagina,
  );

  app.get(
    "/situacao",
    {
      config: { acesso: "autenticado" },
      schema: { response: { 200: respostaSituacaoDasImportacoes } },
    },
    controller.situacao,
  );

  app.get(
    "/:id",
    {
      config: { acesso: "autenticado" },
      schema: { params: comId, response: { 200: respostaImportacao } },
    },
    controller.importacao,
  );

  app.post(
    "/:id/desfazer",
    {
      config: { acesso: "autenticado" },
      schema: { params: comId, response: { 200: respostaMensagem } },
    },
    controller.desfazer,
  );
};

/**
 * Conta da concessionária e correções da água (prefixo
 * /api/v1/operacoes/agua). Quem importa a água corrige; o RLS confere.
 */
export const rotasDasCorrecoesDaAgua: FastifyPluginAsyncZod = async (app) => {
  const importar = { permissao: "operacoes.agua.importar" } as const;
  const leitura = z.object({ id: z.uuid("Leitura inválida.") });

  app.post(
    "/contas",
    { config: importar, schema: { response: { 200: respostaLerConta } } },
    controller.lerConta,
  );

  app.get(
    "/contas/previa-aberta",
    {
      config: importar,
      schema: { response: { 200: respostaPreviaAbertaConta } },
    },
    controller.previaAbertaDaConta,
  );

  app.post(
    "/contas/:id/confirmar",
    {
      config: importar,
      schema: {
        params: z.object({ id: z.uuid("Prévia inválida.") }),
        body: esquemaConta,
        response: { 200: respostaConfirmarConta },
      },
    },
    controller.confirmarConta,
  );

  app.post(
    "/contas/:id/descartar",
    {
      config: importar,
      schema: {
        params: z.object({ id: z.uuid("Prévia inválida.") }),
        response: { 200: respostaMensagem },
      },
    },
    controller.descartarConta,
  );

  // Corrige a conta que já vale (o :id é o da importação).
  app.patch(
    "/contas/:id",
    {
      config: importar,
      schema: {
        params: z.object({ id: z.uuid("Importação inválida.") }),
        body: esquemaConta,
        response: { 200: respostaMensagem },
      },
    },
    controller.corrigirConta,
  );

  app.patch(
    "/leituras/:id",
    {
      config: importar,
      schema: {
        params: leitura,
        body: esquemaLeitura,
        response: { 200: respostaMensagem },
      },
    },
    controller.salvarLeitura,
  );

  app.delete(
    "/leituras/:id",
    {
      config: importar,
      schema: { params: leitura, response: { 200: respostaMensagem } },
    },
    controller.excluirLeitura,
  );

  app.post(
    "/leituras/:id/foto",
    {
      config: importar,
      schema: { params: leitura, response: { 200: respostaMensagem } },
    },
    controller.trocarFoto,
  );

  app.delete(
    "/leituras/:id/foto",
    {
      config: importar,
      schema: { params: leitura, response: { 200: respostaMensagem } },
    },
    controller.tirarFoto,
  );

  app.post(
    "/fotos",
    { config: importar, schema: { response: { 200: respostaMensagem } } },
    controller.fotoDoHidrometro,
  );
};
