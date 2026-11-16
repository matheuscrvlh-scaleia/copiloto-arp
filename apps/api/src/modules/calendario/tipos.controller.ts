import type { EntradaTipo, Tipo } from "@arp/shared/calendario/contratos";
import type { RespostaMensagem } from "@arp/shared/contratos/auth";
import type { FastifyReply, FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import * as service from "./tipos.service";

// HTTP dos tipos de item: lê a requisição validada e chama o service.

type ComId = { Params: { id: string } };

export async function listar(
  request: FastifyRequest,
): Promise<{ tipos: Tipo[] }> {
  return { tipos: await service.listar(contextoDe(request)) };
}

export async function criar(
  request: FastifyRequest<{ Body: EntradaTipo }>,
  reply: FastifyReply,
): Promise<RespostaMensagem> {
  await service.salvar(contextoDe(request), null, request.body);
  reply.code(201);
  return { mensagem: "Tipo criado." };
}

export async function atualizar(
  request: FastifyRequest<ComId & { Body: EntradaTipo }>,
): Promise<RespostaMensagem> {
  await service.salvar(contextoDe(request), request.params.id, request.body);
  return { mensagem: "Tipo atualizado." };
}

export async function excluir(
  request: FastifyRequest<ComId>,
): Promise<RespostaMensagem> {
  await service.excluir(contextoDe(request), request.params.id);
  return { mensagem: "Tipo excluído." };
}
