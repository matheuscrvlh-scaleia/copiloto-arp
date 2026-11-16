import {
  type ConsultaDoPainel,
  consultaDoPainel,
  type ParametrosDoMes,
  parametrosDoMes,
  respostaPainel,
  respostaTabelasDoMes,
} from "@arp/shared/gestao/contratos";
import type { FastifyRequest } from "fastify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { contextoDe } from "@/http/permissao";
import * as service from "./gestao.service";

// Dashboard da Gestão (prefixo /api/v1/gestao). É a primeira tela de toda
// pessoa logada: a rota só exige sessão e o service decide o que cada um vê
// (nada do RH para quem não tem rh.*). Só leitura: os controllers ficam aqui.

const config = { acesso: "autenticado" } as const;

export const rotasDaGestao: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/painel",
    {
      config,
      schema: {
        querystring: consultaDoPainel,
        response: { 200: respostaPainel },
      },
    },
    async (request: FastifyRequest<{ Querystring: ConsultaDoPainel }>) => ({
      pessoas: await service.painel(contextoDe(request), request.query),
    }),
  );

  app.get(
    "/meses/:competencia/tabelas",
    {
      config,
      schema: {
        params: parametrosDoMes,
        response: { 200: respostaTabelasDoMes },
      },
    },
    async (request: FastifyRequest<{ Params: ParametrosDoMes }>) => ({
      tabelas: await service.tabelasDoMes(
        contextoDe(request),
        request.params.competencia,
      ),
    }),
  );
};
