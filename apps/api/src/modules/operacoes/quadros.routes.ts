import {
  respostaLinkDeEnvio,
  respostaMensagem,
} from "@arp/shared/operacoes/contratos/base";
import {
  entradaEnvioDeFoto,
  entradaRegistrarFoto,
  respostaCaixas,
  respostaCriado,
  respostaFichaDaCaixa,
  respostaFotosDoQuadro,
  respostaQuadros,
  respostaSalasDaEnergia,
  respostaTermosRecentes,
} from "@arp/shared/operacoes/contratos/energia";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as controller from "./quadros.controller";

// Quadros de medidores e termo de energia (prefixo
// /api/v1/operacoes/energia). Leitura e cadastro pelo RLS
// (operacoes.energia.*), com as mesmas mensagens do sistema antigo; o termo
// e as fotos conferem a permissão no banco antes de mexer no disco.

const formulario = z.record(z.string(), z.unknown());
const caixa = z.object({ id: z.uuid("Caixa inválida.") });
const quadro = z.object({ id: z.uuid("Quadro inválido.") });

export const rotasDosQuadros: FastifyPluginAsyncZod = async (app) => {
  const sessao = { acesso: "autenticado" } as const;

  app.get(
    "/quadros",
    { config: sessao, schema: { response: { 200: respostaQuadros } } },
    controller.quadros,
  );

  app.get(
    "/caixas",
    {
      config: sessao,
      schema: {
        querystring: z.object({ quadro: z.uuid().optional() }),
        response: { 200: respostaCaixas },
      },
    },
    controller.caixas,
  );

  app.get(
    "/salas",
    { config: sessao, schema: { response: { 200: respostaSalasDaEnergia } } },
    controller.salas,
  );

  app.get(
    "/quadros/:id/fotos",
    {
      config: sessao,
      schema: { params: quadro, response: { 200: respostaFotosDoQuadro } },
    },
    controller.fotos,
  );

  app.get(
    "/caixas/:id",
    {
      config: sessao,
      schema: { params: caixa, response: { 200: respostaFichaDaCaixa } },
    },
    controller.ficha,
  );

  app.get(
    "/termos",
    { config: sessao, schema: { response: { 200: respostaTermosRecentes } } },
    controller.termosRecentes,
  );

  // Redireciona para o link assinado do PDF ou do Word.
  app.get(
    "/termos/:id/arquivo",
    {
      config: sessao,
      schema: {
        params: z.object({ id: z.uuid("Termo não encontrado.") }),
        querystring: z.object({ formato: z.string().max(10).optional() }),
      },
    },
    controller.baixarTermo,
  );

  app.post(
    "/quadros",
    {
      config: sessao,
      schema: { body: formulario, response: { 200: respostaCriado } },
    },
    controller.salvarQuadro,
  );

  app.post(
    "/caixas",
    {
      config: sessao,
      schema: { body: formulario, response: { 200: respostaCriado } },
    },
    controller.salvarCaixa,
  );

  app.post(
    "/caixas/:id/locatario",
    {
      config: sessao,
      schema: {
        params: caixa,
        body: formulario,
        response: { 200: respostaMensagem },
      },
    },
    controller.trocarLocatario,
  );

  app.post(
    "/caixas/:id/enet",
    {
      config: sessao,
      schema: { params: caixa, response: { 200: respostaMensagem } },
    },
    controller.atualizarDoEnet,
  );

  app.post(
    "/caixas/:id/liberar",
    {
      config: sessao,
      schema: {
        params: caixa,
        body: formulario,
        response: { 200: respostaMensagem },
      },
    },
    controller.liberarCaixa,
  );

  app.post(
    "/caixas/:id/termos",
    {
      config: sessao,
      schema: {
        params: caixa,
        body: formulario,
        response: { 200: respostaMensagem },
      },
    },
    controller.emitirTermo,
  );

  app.post(
    "/quadros/:id/fotos/envio",
    {
      config: sessao,
      schema: {
        params: quadro,
        body: entradaEnvioDeFoto,
        response: { 200: respostaLinkDeEnvio },
      },
    },
    controller.prepararFoto,
  );

  app.post(
    "/quadros/:id/fotos",
    {
      config: sessao,
      schema: {
        params: quadro,
        body: entradaRegistrarFoto,
        response: { 200: respostaMensagem },
      },
    },
    controller.registrarFoto,
  );

  app.delete(
    "/quadros/:id/fotos",
    {
      config: sessao,
      schema: {
        params: quadro,
        querystring: z.object({ caminho: z.string().max(400) }),
        response: { 200: respostaMensagem },
      },
    },
    controller.removerFoto,
  );
};
