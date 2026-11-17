import { respostaMensagem } from "@arp/shared/contratos/auth";
import {
  consultaRespostas,
  entradaAtivacao,
  entradaConcluir,
  entradaDesfazerDispensa,
  entradaDispensa,
  entradaInteresse,
  entradaPrazo,
  entradaRascunho,
  entradaTransferencia,
  respostaAplicar,
  respostaConcluir,
  respostaControle,
  respostaEntrevistaSalva,
  respostaFicha,
  respostaRascunho,
  respostaRespostas,
} from "@arp/shared/sustentabilidade/contratos/entrevistas";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as controller from "./entrevistas.controller";

// Entrevistas de resíduos (prefixo /api/v1/sustentabilidade/entrevistas).
// Controle e ficha: ver, aplicar, dispensar (e ver respostas, na ficha),
// conferido no service; o RLS decide o que aparece. Aplicar e respostas têm
// a permissão na rota. As gravações conferem no service (podeAgora) e no RLS,
// com as mensagens do sistema antigo.

const comId = (mensagem: string) => z.object({ id: z.uuid(mensagem) });

export const rotasDasEntrevistas: FastifyPluginAsyncZod = async (app) => {
  const logado = { acesso: "autenticado" } as const;
  const mensagem = { response: { 200: respostaMensagem } } as const;

  app.get(
    "/entrevistas/controle",
    { config: logado, schema: { response: { 200: respostaControle } } },
    controller.controle,
  );

  app.get(
    "/entrevistas/contratos/:id",
    {
      config: logado,
      schema: {
        params: comId("Contrato inválido."),
        response: { 200: respostaFicha },
      },
    },
    controller.ficha,
  );

  app.get(
    "/entrevistas/salvas/:id",
    {
      config: logado,
      schema: {
        params: comId("Entrevista inválida."),
        response: { 200: respostaEntrevistaSalva },
      },
    },
    controller.salva,
  );

  app.get(
    "/entrevistas/contratos/:id/aplicar",
    {
      config: { permissao: "sustentabilidade.entrevistas.aplicar" },
      schema: {
        params: comId("Contrato inválido."),
        response: { 200: respostaAplicar },
      },
    },
    controller.aplicar,
  );

  app.get(
    "/entrevistas/respostas",
    {
      config: { permissao: "sustentabilidade.entrevistas.respostas" },
      schema: {
        querystring: consultaRespostas,
        response: { 200: respostaRespostas },
      },
    },
    controller.respostas,
  );

  app.post(
    "/entrevistas/rascunhos",
    {
      config: logado,
      schema: { body: entradaRascunho, response: { 200: respostaRascunho } },
    },
    controller.rascunho,
  );

  // Multipart: chave, quem, nome e a PNG (assinatura).
  app.post(
    "/entrevistas/assinaturas",
    { config: logado, schema: mensagem },
    controller.assinar,
  );

  app.post(
    "/entrevistas/concluir",
    {
      config: logado,
      schema: { body: entradaConcluir, response: { 200: respostaConcluir } },
    },
    controller.concluir,
  );

  app.post(
    "/entrevistas/interesse",
    { config: logado, schema: { body: entradaInteresse, ...mensagem } },
    controller.interesse,
  );

  app.post(
    "/entrevistas/dispensar",
    { config: logado, schema: { body: entradaDispensa, ...mensagem } },
    controller.dispensar,
  );

  app.post(
    "/entrevistas/desfazer-dispensa",
    { config: logado, schema: { body: entradaDesfazerDispensa, ...mensagem } },
    controller.desfazerDispensa,
  );

  app.post(
    "/entrevistas/ativacao",
    { config: logado, schema: { body: entradaAtivacao, ...mensagem } },
    controller.ativacao,
  );

  app.post(
    "/entrevistas/prazo",
    { config: logado, schema: { body: entradaPrazo, ...mensagem } },
    controller.prazo,
  );

  app.post(
    "/entrevistas/transferir",
    { config: logado, schema: { body: entradaTransferencia, ...mensagem } },
    controller.transferir,
  );

  // Multipart: entrevista_id e o arquivo (PDF, JPG ou PNG).
  app.post(
    "/entrevistas/anexos",
    { config: logado, schema: mensagem },
    controller.anexar,
  );
};
