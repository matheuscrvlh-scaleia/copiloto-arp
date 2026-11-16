import type { EntradaPreviaAgua } from "@arp/shared/operacoes/contratos/agua";
import type { FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import * as service from "./agua-importacao.service";

// HTTP da importação mensal da água. Sem regra e sem SQL.

type ComId = { Params: { id: string } };

export function prepararEnvio(
  request: FastifyRequest<{
    Body: { arquivos: { nome: string; tamanho: number }[] };
  }>,
) {
  return service.prepararEnvioAgua(contextoDe(request), request.body.arquivos);
}

export function previa(request: FastifyRequest<{ Body: EntradaPreviaAgua }>) {
  return service.gerarPrevia(contextoDe(request), request.body);
}

export async function previaAberta(request: FastifyRequest) {
  return { previa: await service.previaAberta(contextoDe(request)) };
}

export async function limparEnvio(
  request: FastifyRequest<{ Params: { envio: string } }>,
) {
  await service.limparEnvio(contextoDe(request), request.params.envio);
  return { mensagem: "Envio descartado." };
}

export function confirmar(
  request: FastifyRequest<ComId & { Body: { motivo?: string } }>,
) {
  return service.confirmar(
    contextoDe(request),
    request.params.id,
    request.body.motivo,
  );
}

export async function descartar(request: FastifyRequest<ComId>) {
  return {
    mensagem: await service.descartarPrevia(
      contextoDe(request),
      request.params.id,
    ),
  };
}
