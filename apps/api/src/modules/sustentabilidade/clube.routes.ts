import { respostaMensagem } from "@arp/shared/contratos/auth";
import {
  acaoDoClube,
  contatoDoParticipante,
  contribuicaoDoClube,
  dadosDoParticipante,
  idDoParticipante,
  novoParticipante,
  saidaDoClube,
  valorCombinado,
} from "@arp/shared/sustentabilidade/clube-cadastro";
import {
  consultaClube,
  consultaContribuicoes,
  consultaLinkDoTermo,
  respostaClube,
  respostaContribuicoes,
  respostaLinkDoTermo,
  respostaParticipante,
  respostaParticipanteCriado,
} from "@arp/shared/sustentabilidade/contratos/clube";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as controller from "./clube.controller";

// Clube SustentArp (prefixo /api/v1/sustentabilidade/clube). Ler: clube.ver
// ou clube.editar (o service confere; o RLS de novo). Gravar: clube.editar,
// conferido no banco pelo service (e o RLS); contato e valor pedem também
// "Ver contato" e "Ver valores". O link do termo vale para quem lê o termo
// pelo RLS (clube ou painel).

const comId = (mensagem: string) => z.object({ id: z.uuid(mensagem) });

export const rotasDoClube: FastifyPluginAsyncZod = async (app) => {
  const logado = { acesso: "autenticado" } as const;

  app.get(
    "/clube",
    {
      config: logado,
      schema: { querystring: consultaClube, response: { 200: respostaClube } },
    },
    controller.lista,
  );

  app.get(
    "/clube/participantes/:id",
    {
      config: logado,
      schema: {
        params: comId("Participante inválido."),
        response: { 200: respostaParticipante },
      },
    },
    controller.participante,
  );

  app.get(
    "/clube/contribuicoes",
    {
      config: logado,
      schema: {
        querystring: consultaContribuicoes,
        response: { 200: respostaContribuicoes },
      },
    },
    controller.contribuicoes,
  );

  app.get(
    "/clube/termos/:id/link",
    {
      config: logado,
      schema: {
        params: comId("Termo inválido."),
        querystring: consultaLinkDoTermo,
        response: { 200: respostaLinkDoTermo },
      },
    },
    controller.linkDoTermo,
  );

  app.post(
    "/clube/participantes",
    {
      config: logado,
      schema: {
        body: novoParticipante,
        response: { 201: respostaParticipanteCriado },
      },
    },
    controller.criarParticipante,
  );

  app.post(
    "/clube/participantes/dados",
    {
      config: logado,
      schema: {
        body: dadosDoParticipante,
        response: { 200: respostaMensagem },
      },
    },
    controller.salvarDados,
  );

  app.post(
    "/clube/participantes/contato",
    {
      config: logado,
      schema: {
        body: contatoDoParticipante,
        response: { 200: respostaMensagem },
      },
    },
    controller.salvarContato,
  );

  app.post(
    "/clube/participantes/valor",
    {
      config: logado,
      schema: { body: valorCombinado, response: { 200: respostaMensagem } },
    },
    controller.salvarValor,
  );

  app.post(
    "/clube/participantes/saida",
    {
      config: logado,
      schema: { body: saidaDoClube, response: { 200: respostaMensagem } },
    },
    controller.registrarSaida,
  );

  app.post(
    "/clube/participantes/reativar",
    {
      config: logado,
      schema: {
        body: z.object({ participante_id: idDoParticipante }),
        response: { 200: respostaMensagem },
      },
    },
    controller.reativar,
  );

  // Multipart: participante_id, ano, assinado_em e o PDF (arquivo).
  app.post(
    "/clube/termos",
    { config: logado, schema: { response: { 200: respostaMensagem } } },
    controller.termoAnexo,
  );

  // Multipart: participante_id, ano, assinado_em, nome, documento e a PNG
  // da assinatura (assinatura).
  app.post(
    "/clube/termos/assinado",
    { config: logado, schema: { response: { 200: respostaMensagem } } },
    controller.termoAssinado,
  );

  app.delete(
    "/clube/termos/:id",
    {
      config: logado,
      schema: {
        params: comId("Termo inválido."),
        response: { 200: respostaMensagem },
      },
    },
    controller.removerTermo,
  );

  app.post(
    "/clube/contribuicoes",
    {
      config: logado,
      schema: {
        body: contribuicaoDoClube,
        response: { 200: respostaMensagem },
      },
    },
    controller.registrarContribuicao,
  );

  app.delete(
    "/clube/contribuicoes/:id",
    {
      config: logado,
      schema: {
        params: comId("Contribuição inválida."),
        response: { 200: respostaMensagem },
      },
    },
    controller.removerContribuicao,
  );

  app.post(
    "/clube/acoes",
    {
      config: logado,
      schema: { body: acaoDoClube, response: { 200: respostaMensagem } },
    },
    controller.registrarAcao,
  );

  app.delete(
    "/clube/acoes/:id",
    {
      config: logado,
      schema: {
        params: comId("Ação inválida."),
        response: { 200: respostaMensagem },
      },
    },
    controller.removerAcao,
  );
};
