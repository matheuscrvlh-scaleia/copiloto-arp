import type { RespostaMensagem } from "@arp/shared/comercial/contratos/base";
import type { Formulario } from "@arp/shared/comercial/contratos/configuracoes";
import type {
  RespostaApoioEventos,
  RespostaEventos,
  RespostaFeriadosEventos,
  RespostaProposta,
} from "@arp/shared/comercial/contratos/eventos";
import type { StatusProposta } from "@arp/shared/comercial/eventos";
import type { FastifyReply, FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import { disposicao } from "@/infra/arquivos/http";
import * as service from "./eventos.service";

type ComId = { Params: { id: string } };

export function tela(request: FastifyRequest): Promise<RespostaEventos> {
  return service.tela(contextoDe(request));
}

export function apoio(request: FastifyRequest): Promise<RespostaApoioEventos> {
  return service.apoio(contextoDe(request));
}

export function feriados(
  request: FastifyRequest<{ Querystring: { anos: string } }>,
): Promise<RespostaFeriadosEventos> {
  return service.feriados(contextoDe(request), request.query.anos);
}

export function proposta(
  request: FastifyRequest<ComId>,
): Promise<RespostaProposta> {
  return service.proposta(contextoDe(request), request.params.id);
}

export async function criar(
  request: FastifyRequest<{ Body: Formulario }>,
  reply: FastifyReply,
): Promise<RespostaMensagem & { id: string }> {
  const id = await service.criar(contextoDe(request), request.body);
  reply.code(201);
  return { mensagem: "Proposta salva.", id };
}

export async function salvar(
  request: FastifyRequest<ComId & { Body: Formulario }>,
): Promise<RespostaMensagem> {
  await service.salvar(contextoDe(request), request.params.id, request.body);
  return { mensagem: "Proposta salva." };
}

export async function mudarStatus(
  request: FastifyRequest<ComId & { Body: { status: StatusProposta } }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.mudarStatus(
      contextoDe(request),
      request.params.id,
      request.body.status,
    ),
  };
}

export async function pdf(request: FastifyRequest<ComId>, reply: FastifyReply) {
  const { bytes, nome } = await service.pdf(
    contextoDe(request),
    request.params.id,
  );
  return reply
    .header("content-type", "application/pdf")
    .header("content-disposition", disposicao("attachment", nome))
    .header("cache-control", "private, no-store")
    .send(Buffer.from(bytes));
}
