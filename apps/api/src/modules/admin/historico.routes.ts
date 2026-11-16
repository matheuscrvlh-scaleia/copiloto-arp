import {
  type ConsultaDoHistorico,
  consultaDoHistorico,
  respostaAutores,
  respostaHistorico,
} from "@arp/shared/admin/contratos";
import type { FastifyRequest } from "fastify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { contextoDe } from "@/http/permissao";
import * as service from "./historico.service";

// Histórico (prefixo /api/v1/admin). Só leitura: os controllers ficam aqui.

const config = { permissao: "admin.historico" } as const;

export const rotasDoHistorico: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/historico",
    {
      config,
      schema: {
        querystring: consultaDoHistorico,
        response: { 200: respostaHistorico },
      },
    },
    (request: FastifyRequest<{ Querystring: ConsultaDoHistorico }>) =>
      service.historico(contextoDe(request), request.query),
  );

  app.get(
    "/historico/autores",
    { config, schema: { response: { 200: respostaAutores } } },
    (request) => service.autores(contextoDe(request)),
  );
};
