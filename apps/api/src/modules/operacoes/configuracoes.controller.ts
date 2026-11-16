import type { HidrometroForm, SalaForm } from "@arp/shared/operacoes/cadastros";
import type { FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import * as cadastros from "./cadastros.service";
import * as parametros from "./parametros.service";

// HTTP das gravações de Configurações de Operações. Sem regra e sem SQL.

type ComId = { Params: { id: string } };
type Formulario = { Body: Record<string, unknown> };

export async function salvarHidrometro(
  request: FastifyRequest<{ Body: HidrometroForm }>,
) {
  return {
    mensagem: await cadastros.salvarHidrometro(
      contextoDe(request),
      request.body,
    ),
  };
}

export async function excluirHidrometro(request: FastifyRequest<ComId>) {
  return {
    mensagem: await cadastros.excluirHidrometro(
      contextoDe(request),
      request.params.id,
    ),
  };
}

export async function salvarSala(request: FastifyRequest<{ Body: SalaForm }>) {
  return {
    mensagem: await cadastros.salvarSala(contextoDe(request), request.body),
  };
}

export async function excluirSala(request: FastifyRequest<ComId>) {
  return {
    mensagem: await cadastros.excluirSala(
      contextoDe(request),
      request.params.id,
    ),
  };
}

export async function salvarParametros(request: FastifyRequest<Formulario>) {
  return {
    mensagem: await parametros.salvarParametros(
      contextoDe(request),
      request.body,
    ),
  };
}

export async function removerExemplos(request: FastifyRequest) {
  return { mensagem: await parametros.removerExemplos(contextoDe(request)) };
}

export async function salvarUnidade(request: FastifyRequest<Formulario>) {
  return {
    mensagem: await parametros.salvarUnidade(contextoDe(request), request.body),
  };
}
