import type { FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import * as service from "./base.service";

// HTTP da base de Operações. Sem regra e sem SQL.

export async function parametros(request: FastifyRequest) {
  return { parametros: await service.parametros(contextoDe(request)) };
}

export async function hidrometros(request: FastifyRequest) {
  return { hidrometros: await service.hidrometros(contextoDe(request)) };
}

export async function salas(request: FastifyRequest) {
  return { salas: await service.salas(contextoDe(request)) };
}

export async function historicoDosParametros(request: FastifyRequest) {
  return {
    alteracoes: await service.historicoDosParametros(contextoDe(request)),
  };
}

export async function dadosDeExemplo(request: FastifyRequest) {
  return { tabelas: await service.dadosDeExemplo(contextoDe(request)) };
}

export async function unidadesDeEnergia(request: FastifyRequest) {
  return { unidades: await service.unidadesDeEnergia(contextoDe(request)) };
}
