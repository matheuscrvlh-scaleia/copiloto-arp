import type { FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import * as service from "./base.service";

// HTTP da base do Sustentabilidade. Sem regra e sem SQL.

export function contexto(request: FastifyRequest) {
  return service.contextoDaTela(contextoDe(request));
}

export async function parametros(request: FastifyRequest) {
  return { parametros: await service.parametrosDaTela(contextoDe(request)) };
}

export async function coletores(request: FastifyRequest) {
  return { coletores: await service.coletoresDaTela(contextoDe(request)) };
}
