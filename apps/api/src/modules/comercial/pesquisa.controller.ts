import type { RespostaMensagem } from "@arp/shared/comercial/contratos/base";
import type { Formulario } from "@arp/shared/comercial/contratos/configuracoes";
import type {
  RespostaApoioPesquisa,
  RespostaImovel,
  RespostaPesquisa,
} from "@arp/shared/comercial/contratos/pesquisa";
import type { FastifyReply, FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import * as service from "./pesquisa.service";

type ComId = { Params: { id: string } };

export function tela(request: FastifyRequest): Promise<RespostaPesquisa> {
  return service.tela(contextoDe(request));
}

export function apoio(
  request: FastifyRequest,
): Promise<RespostaApoioPesquisa> {
  return service.apoio(contextoDe(request));
}

export function imovel(
  request: FastifyRequest<ComId>,
): Promise<RespostaImovel> {
  return service.imovel(contextoDe(request), request.params.id);
}

export async function cadastrar(
  request: FastifyRequest<{ Body: Formulario }>,
  reply: FastifyReply,
): Promise<RespostaMensagem & { id: string }> {
  const id = await service.cadastrar(contextoDe(request), request.body);
  reply.code(201);
  return { mensagem: "Imóvel cadastrado.", id };
}

export async function corrigir(
  request: FastifyRequest<ComId & { Body: Formulario }>,
): Promise<RespostaMensagem> {
  await service.corrigir(contextoDe(request), request.params.id, request.body);
  return { mensagem: "Imóvel corrigido. A alteração ficou no histórico." };
}
