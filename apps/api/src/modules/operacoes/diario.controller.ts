import type {
  buscaDasPartes,
  buscaDosRelatorios,
} from "@arp/shared/operacoes/contratos/diario";
import type { FastifyRequest } from "fastify";
import type { z } from "zod";
import { contextoDe } from "@/http/permissao";
import * as service from "./diario.service";

// HTTP do Diário de Obra. Sem regra e sem SQL.

type ComId = { Params: { id: string } };

export async function estado(request: FastifyRequest) {
  return { estado: await service.estadoDoDiario(contextoDe(request)) };
}

export function obras(request: FastifyRequest) {
  return service.dadosDoPainel(contextoDe(request));
}

export async function obra(request: FastifyRequest<ComId>) {
  return {
    obra: await service.obraDoDiario(contextoDe(request), request.params.id),
  };
}

export async function partes(
  request: FastifyRequest<
    ComId & { Querystring: z.infer<typeof buscaDasPartes> }
  >,
) {
  const { partes, de, ate } = request.query;
  return {
    partes: await service.partesDosRelatorios(
      contextoDe(request),
      request.params.id,
      partes,
      de && ate ? { de, ate } : undefined,
    ),
  };
}

export async function relatorios(
  request: FastifyRequest<{
    Querystring: z.infer<typeof buscaDosRelatorios>;
  }>,
) {
  return {
    relatorios: await service.relatoriosDoPeriodo(
      contextoDe(request),
      request.query,
    ),
  };
}

export function opcoes(request: FastifyRequest) {
  return service.opcoesDosRelatorios(contextoDe(request));
}

export async function relatorio(request: FastifyRequest<ComId>) {
  return {
    relatorio: await service.relatorioCompleto(
      contextoDe(request),
      request.params.id,
    ),
  };
}

export async function atualizar(request: FastifyRequest) {
  return { mensagem: await service.atualizarAgora(contextoDe(request)) };
}
