import { respostaMensagem } from "@arp/shared/contratos/auth";
import {
  respostaCandidatos,
  respostaChamadosFixos,
} from "@arp/shared/sustentabilidade/contratos/chamados-fixos";
import { esquemaChamadoFixo } from "@arp/shared/sustentabilidade/painel-parametros";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as controller from "./chamados-fixos.controller";

// Chamados fixos (prefixo /api/v1/sustentabilidade/chamados-fixos), da aba
// de Parâmetros: sustentabilidade.parametros. As leituras exigem a permissão
// na rota; a gravação a confere no banco pelo service (mensagem antiga).

export const rotasDosChamadosFixos: FastifyPluginAsyncZod = async (app) => {
  const logado = { acesso: "autenticado" } as const;
  const parametros = { permissao: "sustentabilidade.parametros" } as const;

  app.get(
    "/chamados-fixos",
    {
      config: parametros,
      schema: { response: { 200: respostaChamadosFixos } },
    },
    controller.estados,
  );

  app.get(
    "/chamados-fixos/:tipo/candidatos",
    {
      config: parametros,
      schema: {
        params: z.object({ tipo: esquemaChamadoFixo.shape.tipo }),
        response: { 200: respostaCandidatos },
      },
    },
    controller.candidatos,
  );

  app.post(
    "/chamados-fixos",
    {
      config: logado,
      schema: {
        body: esquemaChamadoFixo,
        response: { 200: respostaMensagem },
      },
    },
    controller.criar,
  );
};
