import type {
  ConsultaItens,
  EntradaItem,
  ItemTela,
} from "@arp/shared/calendario/contratos";
import type { RespostaMensagem } from "@arp/shared/contratos/auth";
import type { FastifyReply, FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import * as service from "./itens.service";

// HTTP dos itens da agenda: lê a requisição validada e chama o service.

type ComId = { Params: { id: string } };

export async function listar(
  request: FastifyRequest<{ Querystring: ConsultaItens }>,
): Promise<{ itens: ItemTela[] }> {
  const { de, ate } = request.query;
  return { itens: await service.itensEntre(contextoDe(request), de, ate) };
}

export async function criar(
  request: FastifyRequest<{ Body: EntradaItem }>,
  reply: FastifyReply,
): Promise<RespostaMensagem> {
  await service.salvar(contextoDe(request), null, request.body);
  reply.code(201);
  return { mensagem: "Item criado." };
}

export async function atualizar(
  request: FastifyRequest<ComId & { Body: EntradaItem }>,
): Promise<RespostaMensagem> {
  await service.salvar(contextoDe(request), request.params.id, request.body);
  return { mensagem: "Item atualizado." };
}

export async function excluir(
  request: FastifyRequest<ComId>,
): Promise<RespostaMensagem> {
  await service.excluir(contextoDe(request), request.params.id);
  return { mensagem: "Item excluído." };
}

export async function concluir(
  request: FastifyRequest<ComId & { Body: { feito: boolean } }>,
): Promise<RespostaMensagem> {
  const { feito } = request.body;
  await service.concluir(contextoDe(request), request.params.id, feito);
  return { mensagem: feito ? "Marcado como feito." : "Reaberto." };
}
