import {
  paramsConsulta,
  respostaCep,
  respostaCnpj,
} from "@arp/shared/comercial/contratos/consultas";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { contextoDe, origemDe } from "@/http/permissao";
import * as service from "./consultas.service";

// CEP e CNPJ dos formulários internos. A ficha pública (parte B) tem as
// suas rotas, que conferem o token e chamam o mesmo service.

export const rotasDeConsultas: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/consultas/cep/:valor",
    {
      config: { acesso: "autenticado" },
      schema: { params: paramsConsulta, response: { 200: respostaCep } },
    },
    async (request) => {
      contextoDe(request);
      return {
        endereco: await service.consultarCep(
          request.params.valor,
          origemDe(request),
        ),
      };
    },
  );

  app.get(
    "/consultas/cnpj/:valor",
    {
      config: { acesso: "autenticado" },
      schema: { params: paramsConsulta, response: { 200: respostaCnpj } },
    },
    async (request) => {
      contextoDe(request);
      return {
        empresa: await service.consultarCnpj(
          request.params.valor,
          origemDe(request),
        ),
      };
    },
  );
};
