import { respostaMensagem } from "@arp/shared/os/contratos/base";
import {
  detalheChamado,
  entradaAcao,
  entradaAlteracao,
  entradaAndarDestino,
  entradaChecklist,
  entradaMoverDestino,
  entradaSeguir,
  entradaTarefaDestino,
  idDoChamado,
  respostaContatos,
  respostaCriacao,
} from "@arp/shared/os/contratos/chamados";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./chamados.controller";

// /api/v1/os/chamados e /api/v1/os/destinos: o detalhe do chamado (ou da OS)
// e as gravações dele. Tudo para quem usa o Tickets (os.acessar); quem vê e
// quem altera cada chamado é o RLS e o gatilho os.validar_chamado.

const ACESSO = { permissao: "os.acessar" } as const;
const comMensagem = { 200: respostaMensagem };

export const rotasDeChamados: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/chamados/:id",
    {
      config: ACESSO,
      // O id inválido responde 404 como o que não existe (a tela mostra o
      // mesmo cartão): quem confere é o service.
      schema: { response: { 200: detalheChamado } },
    },
    controller.detalhe,
  );

  app.get(
    "/contatos",
    { config: ACESSO, schema: { response: { 200: respostaContatos } } },
    controller.contatos,
  );

  // Formulário com arquivos (multipart): o controller valida os campos.
  app.post(
    "/chamados",
    { config: ACESSO, schema: { response: { 201: respostaCriacao } } },
    controller.abrir,
  );

  app.post(
    "/chamados/:id/acoes",
    {
      config: ACESSO,
      schema: { params: idDoChamado, body: entradaAcao, response: comMensagem },
    },
    controller.agir,
  );

  app.patch(
    "/chamados/:id",
    {
      config: ACESSO,
      schema: {
        params: idDoChamado,
        body: entradaAlteracao,
        response: comMensagem,
      },
    },
    controller.alterar,
  );

  app.post(
    "/chamados/:id/checklist",
    {
      config: ACESSO,
      schema: {
        params: idDoChamado,
        body: entradaChecklist,
        response: comMensagem,
      },
    },
    controller.checklist,
  );

  // Formulário com arquivos (multipart): o controller valida os campos.
  app.post(
    "/chamados/:id/comentarios",
    {
      config: ACESSO,
      schema: { params: idDoChamado, response: { 201: respostaMensagem } },
    },
    controller.comentar,
  );

  app.post(
    "/chamados/:id/seguir",
    {
      config: ACESSO,
      schema: {
        params: idDoChamado,
        body: entradaSeguir,
        response: comMensagem,
      },
    },
    controller.seguir,
  );

  app.post(
    "/chamados/:id/leitura",
    { config: ACESSO, schema: { params: idDoChamado, response: comMensagem } },
    controller.marcarLido,
  );

  app.post(
    "/destinos/:id/mover",
    {
      config: ACESSO,
      schema: {
        params: idDoChamado,
        body: entradaMoverDestino,
        response: comMensagem,
      },
    },
    controller.moverDestino,
  );

  app.post(
    "/destinos/:id/andar",
    {
      config: ACESSO,
      schema: {
        params: idDoChamado,
        body: entradaAndarDestino,
        response: comMensagem,
      },
    },
    controller.andarDestino,
  );

  app.patch(
    "/destinos/:id",
    {
      config: ACESSO,
      schema: {
        params: idDoChamado,
        body: entradaTarefaDestino,
        response: comMensagem,
      },
    },
    controller.tarefaDoDestino,
  );
};
