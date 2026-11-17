import { respostaMensagem } from "@arp/shared/contratos/auth";
import {
  entradaDescartarEnvio,
  entradaEscolhas,
  entradaLerEnvio,
  entradaPrepararEnvio,
  respostaDoEnvio,
  respostaEnvioPreparado,
  respostaImportacao,
  respostaImportacoes,
} from "@arp/shared/sustentabilidade/contratos/importacoes";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as controller from "./importacoes.controller";

// Importações do histórico (prefixo /api/v1/sustentabilidade/importacoes):
// a lista, o detalhe com a prévia e os três passos (enviar e ler, escolhas,
// confirmar ou desfazer). Tudo exige "Importar histórico"; o service confere
// de novo no banco e o RLS só deixa gravar na prévia da própria pessoa.

const config = { permissao: "sustentabilidade.importar" } as const;
const params = z.object({ id: z.string().max(60) });
const mensagem = { 200: respostaMensagem };

export const rotasDasImportacoes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/importacoes",
    { config, schema: { response: { 200: respostaImportacoes } } },
    controller.lista,
  );

  app.get(
    "/importacoes/:id",
    { config, schema: { params, response: { 200: respostaImportacao } } },
    controller.detalhe,
  );

  // Passo 1a: o link para o navegador enviar o arquivo direto.
  app.post(
    "/importacoes/envio",
    {
      config,
      schema: {
        body: entradaPrepararEnvio,
        response: { 200: respostaEnvioPreparado },
      },
    },
    controller.prepararEnvio,
  );

  // "Não substituir": o arquivo enviado sai do disco.
  app.post(
    "/importacoes/envio/descartar",
    { config, schema: { body: entradaDescartarEnvio, response: mensagem } },
    controller.descartarEnvio,
  );

  // Passo 1b: o arquivo chegou; lê e cria a prévia.
  app.post(
    "/importacoes",
    {
      config,
      schema: { body: entradaLerEnvio, response: { 200: respostaDoEnvio } },
    },
    controller.lerEnvio,
  );

  app.put(
    "/importacoes/:id/escolhas",
    { config, schema: { params, body: entradaEscolhas, response: mensagem } },
    controller.salvarEscolhas,
  );

  app.post(
    "/importacoes/:id/confirmar",
    { config, schema: { params, response: mensagem } },
    controller.confirmar,
  );

  // Cancela a prévia ou desfaz a importação confirmada.
  app.post(
    "/importacoes/:id/desfazer",
    { config, schema: { params, response: mensagem } },
    controller.desfazer,
  );
};
