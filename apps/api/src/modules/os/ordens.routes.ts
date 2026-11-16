import { respostaMensagem } from "@arp/shared/os/contratos/base";
import {
  blocoDaOS,
  consultaDoPdf,
  idDaOrdem,
  idDoItem,
  paginaTerceirizado,
  respostaDaOS,
  respostaOrdens,
  tokenDoLink,
} from "@arp/shared/os/contratos/ordens";
import { consultaLivre, planilha } from "@arp/shared/os/contratos/visoes";
import type { RateLimitOptions } from "@fastify/rate-limit";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./ordens.controller";

// /api/v1/os/ordens: a tela Acompanhamento das OS (lista, cartões,
// exportação e PDF) e o bloco da OS no detalhe (tempo, execução, materiais,
// custos, arquivos, assinatura e terceirizado). Tudo para quem usa o Tickets
// (os.acessar); quem vê e quem altera cada OS é o RLS (os.pode_editar_ordem)
// e os valores só chegam a quem tem os.custos.
//
// /api/v1/os/ordem-publica/:token: o link do terceirizado (tela /ordem/:token),
// sem login: vale pelo token, conferido no service a cada chamada.

const ACESSO = { permissao: "os.acessar" } as const;
const daOS = { 200: respostaDaOS };

/** Link do terceirizado: cada toque é um pedido e a tela relê a página. */
const LIMITE_DO_LINK = {
  max: 60,
  timeWindow: "1 minute",
} as const satisfies RateLimitOptions;
const PUBLICO = { acesso: "publico", rateLimit: LIMITE_DO_LINK } as const;
const comMensagem = { 200: respostaMensagem };

export const rotasDeOrdens: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/ordens",
    {
      config: ACESSO,
      schema: { querystring: consultaLivre, response: { 200: respostaOrdens } },
    },
    controller.listar,
  );

  app.get(
    "/ordens/exportacao",
    {
      config: ACESSO,
      schema: { querystring: consultaLivre, response: { 200: planilha } },
    },
    controller.exportar,
  );

  // Download: sem schema de resposta.
  app.get(
    "/ordens/pdf",
    { config: ACESSO, schema: { querystring: consultaDoPdf } },
    controller.pdf,
  );

  app.get(
    "/ordens/:id/bloco",
    {
      config: ACESSO,
      // O id inválido responde 404 como o que não existe.
      schema: { params: idDaOrdem, response: { 200: blocoDaOS } },
    },
    controller.bloco,
  );

  app.post(
    "/ordens/:id/tempo/iniciar",
    { config: ACESSO, schema: { params: idDaOrdem, response: daOS } },
    controller.iniciarTempo,
  );

  // Os formulários do bloco são validados no controller (rótulo do campo).
  const comCorpo = {
    config: ACESSO,
    schema: { params: idDaOrdem, body: consultaLivre, response: daOS },
  };
  const comItem = {
    config: ACESSO,
    schema: { params: idDoItem, response: daOS },
  };

  app.post("/ordens/:id/tempo/pausar", comCorpo, controller.pausarTempo);
  app.post("/ordens/:id/sessoes", comCorpo, controller.salvarSessao);
  app.delete("/ordens/:id/sessoes/:item", comItem, controller.excluirSessao);
  app.patch("/ordens/:id/execucao", comCorpo, controller.salvarExecucao);
  app.post("/ordens/:id/materiais", comCorpo, controller.salvarMaterial);
  app.delete(
    "/ordens/:id/materiais/:item",
    comItem,
    controller.excluirMaterial,
  );
  app.patch("/ordens/:id/rateio", comCorpo, controller.salvarRateio);
  app.patch(
    "/ordens/:id/custo-terceirizado",
    comCorpo,
    controller.salvarCustoTerceirizado,
  );
  app.patch(
    "/ordens/:id/outros-custos",
    comCorpo,
    controller.salvarOutrosCustos,
  );
  app.patch("/ordens/:id/resultado", comCorpo, controller.salvarResultado);

  app.post(
    "/ordens/:id/concluir",
    { config: ACESSO, schema: { params: idDaOrdem, response: daOS } },
    controller.concluir,
  );

  // Formulários com arquivo (multipart): o controller valida os campos.
  app.post(
    "/ordens/:id/arquivos",
    { config: ACESSO, schema: { params: idDaOrdem, response: daOS } },
    controller.enviarArquivos,
  );
  app.delete("/ordens/:id/arquivos/:item", comItem, controller.removerArquivo);
  app.post(
    "/ordens/:id/assinatura",
    { config: ACESSO, schema: { params: idDaOrdem, response: daOS } },
    controller.assinar,
  );

  app.post(
    "/ordens/:id/terceirizado/link",
    comCorpo,
    controller.enviarAoTerceirizado,
  );
  app.delete(
    "/ordens/:id/terceirizado/link",
    { config: ACESSO, schema: { params: idDaOrdem, response: daOS } },
    controller.cancelarLink,
  );
  app.post(
    "/ordens/:id/terceirizado/usar",
    comCorpo,
    controller.usarDoTerceirizado,
  );
  app.post(
    "/ordens/:id/orcamento/aprovar",
    { config: ACESSO, schema: { params: idDaOrdem, response: daOS } },
    controller.aprovarOrcamento,
  );

  // -------------------------------------------------------------------------
  // Link do terceirizado
  // -------------------------------------------------------------------------

  app.get(
    "/ordem-publica/:token",
    {
      config: PUBLICO,
      schema: { params: tokenDoLink, response: { 200: paginaTerceirizado } },
    },
    controller.paginaPublica,
  );

  const doLink = {
    config: PUBLICO,
    schema: { params: tokenDoLink, response: comMensagem },
  };
  const doLinkComCorpo = {
    config: PUBLICO,
    schema: { params: tokenDoLink, body: consultaLivre, response: comMensagem },
  };

  app.post("/ordem-publica/:token/aceite", doLink, controller.aceitar);
  app.post("/ordem-publica/:token/recusa", doLinkComCorpo, controller.recusar);
  app.post("/ordem-publica/:token/chegada", doLinkComCorpo, controller.cheguei);
  app.post(
    "/ordem-publica/:token/termino",
    doLinkComCorpo,
    controller.terminei,
  );
  app.post(
    "/ordem-publica/:token/relatorio",
    doLinkComCorpo,
    controller.relatorio,
  );
  app.post("/ordem-publica/:token/arquivos", doLink, controller.arquivosDoLink);
  app.post(
    "/ordem-publica/:token/assinatura",
    doLink,
    controller.assinaturaDoLink,
  );
};
