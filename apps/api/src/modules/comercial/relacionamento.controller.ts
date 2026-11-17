import type { RespostaMensagem } from "@arp/shared/comercial/contratos/base";
import type {
  ConsultaContatos,
  EntradaContato,
  RespostaAniversarios,
  RespostaConfigRelacionamento,
  RespostaContato,
  RespostaContatos,
  RespostaLocatarios,
} from "@arp/shared/comercial/contratos/relacionamento";
import type { FastifyReply, FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import * as service from "./relacionamento.service";
import { sincronizarSac } from "./sac.service";

type ComId = { Params: { id: string } };

export async function sac(request: FastifyRequest): Promise<RespostaMensagem> {
  return { mensagem: await sincronizarSac(contextoDe(request)) };
}

export function config(
  request: FastifyRequest,
): Promise<RespostaConfigRelacionamento> {
  return service.configDoRelacionamento(contextoDe(request));
}

export function locatarios(request: FastifyRequest): RespostaLocatarios {
  return service.locatarios(contextoDe(request));
}

export function aniversarios(
  request: FastifyRequest<{ Querystring: { mes?: number } }>,
): Promise<RespostaAniversarios> {
  return service.aniversarios(contextoDe(request), request.query.mes);
}

export function contatos(
  request: FastifyRequest<{ Querystring: ConsultaContatos }>,
): Promise<RespostaContatos> {
  return service.contatos(contextoDe(request), request.query);
}

export function contato(
  request: FastifyRequest<ComId>,
): Promise<RespostaContato> {
  return service.contato(contextoDe(request), request.params.id);
}

export async function registrar(
  request: FastifyRequest<{ Body: EntradaContato }>,
  reply: FastifyReply,
): Promise<RespostaMensagem> {
  await service.registrarContato(contextoDe(request), request.body);
  reply.code(201);
  return { mensagem: "Contato registrado." };
}

export async function editar(
  request: FastifyRequest<ComId & { Body: EntradaContato }>,
): Promise<RespostaMensagem> {
  await service.editarContato(
    contextoDe(request),
    request.params.id,
    request.body,
  );
  return { mensagem: "Registro alterado." };
}

export async function excluir(
  request: FastifyRequest<ComId>,
): Promise<RespostaMensagem> {
  await service.excluirContato(contextoDe(request), request.params.id);
  return { mensagem: "Registro excluído." };
}
