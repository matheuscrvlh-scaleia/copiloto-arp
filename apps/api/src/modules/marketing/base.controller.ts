import type { consultaHistorico } from "@arp/shared/marketing/contratos/base";
import type { FastifyRequest } from "fastify";
import type { z } from "zod";
import { contextoDe } from "@/http/permissao";
import * as base from "./base.service";
import { dadosBenchmark } from "./benchmark.service";
import { agendaDoSite } from "./eventos.service";
import { historicoMkt } from "./historico.service";
import { dadosPublico } from "./publico.service";

// HTTP da base do Marketing: só repassa ao service.

export async function parametros(request: FastifyRequest) {
  return { parametros: await base.parametros(contextoDe(request)) };
}

export async function locatarios(request: FastifyRequest) {
  return { locatarios: await base.locatarios(contextoDe(request)) };
}

export async function landingPages(request: FastifyRequest) {
  return { landingPages: await base.landingPages(contextoDe(request)) };
}

export async function regrasAlerta(request: FastifyRequest) {
  return { regras: await base.regrasAlerta(contextoDe(request)) };
}

export function temasECodigos(request: FastifyRequest) {
  return base.temasECodigos(contextoDe(request));
}

export async function metas(request: FastifyRequest) {
  return { metas: await base.metas(contextoDe(request)) };
}

export async function referencias(request: FastifyRequest) {
  return { referencias: await base.referencias(contextoDe(request)) };
}

export async function benchmark(request: FastifyRequest) {
  return { benchmark: await dadosBenchmark(contextoDe(request)) };
}

export async function publico(request: FastifyRequest) {
  return { publico: await dadosPublico(contextoDe(request)) };
}

export function agenda(request: FastifyRequest) {
  return agendaDoSite(contextoDe(request));
}

export async function historico(
  request: FastifyRequest<{ Querystring: z.infer<typeof consultaHistorico> }>,
) {
  return {
    alteracoes: await historicoMkt(contextoDe(request), request.query.limite),
  };
}
