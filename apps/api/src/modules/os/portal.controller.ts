import type { RespostaMensagem } from "@arp/shared/os/contratos/base";
import type {
  AgendaDoPortal,
  ConsultaDasLojas,
  ConsultaDosLinks,
  EntradaAgenda,
  EntradaBloqueio,
  EntradaCancelarAgendamento,
  EntradaEncerrarAcesso,
  EntradaLoja,
  EntradaRemarcarAgendamento,
  LojaDoPortal,
  RespostaAgendas,
  RespostaGravacao,
  RespostaLinks,
} from "@arp/shared/os/contratos/portal";
import type { Planilha } from "@arp/shared/os/contratos/visoes";
import type { FastifyReply, FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import * as service from "./portal.service";

// HTTP da tela interna do Portal lojista: lê a requisição validada e chama
// o service.

type ComId = { Params: { id: string } };

export function links(
  request: FastifyRequest<{ Querystring: ConsultaDosLinks }>,
): Promise<RespostaLinks> {
  return service.links(contextoDe(request), request.query);
}

export function exportarLinks(
  request: FastifyRequest<{ Querystring: ConsultaDosLinks }>,
): Promise<Planilha> {
  return service.exportarLinks(contextoDe(request), request.query);
}

export async function encerrarAcesso(
  request: FastifyRequest<{ Body: EntradaEncerrarAcesso }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.encerrarAcesso(
      contextoDe(request),
      request.body.loja,
    ),
  };
}

export function lojas(
  request: FastifyRequest<{ Querystring: ConsultaDasLojas }>,
): Promise<{ lojas: LojaDoPortal[]; total: number }> {
  return service.listarLojas(contextoDe(request), request.query);
}

export function exportarLojas(
  request: FastifyRequest<{ Querystring: ConsultaDasLojas }>,
): Promise<Planilha> {
  return service.exportarLojas(contextoDe(request), request.query);
}

export async function loja(
  request: FastifyRequest<ComId>,
): Promise<{ loja: LojaDoPortal | null }> {
  return {
    loja: await service.lerLoja(contextoDe(request), request.params.id),
  };
}

export async function salvarLoja(
  request: FastifyRequest<{ Body: EntradaLoja }>,
  reply: FastifyReply,
): Promise<RespostaGravacao> {
  const r = await service.salvarLoja(contextoDe(request), request.body);
  if (r.criado) reply.code(201);
  return r;
}

export function agendas(request: FastifyRequest): Promise<RespostaAgendas> {
  return service.lerAgendas(contextoDe(request));
}

export async function agenda(
  request: FastifyRequest<ComId>,
): Promise<{ agenda: AgendaDoPortal | null }> {
  return {
    agenda: await service.lerAgenda(contextoDe(request), request.params.id),
  };
}

export async function salvarAgenda(
  request: FastifyRequest<{ Body: EntradaAgenda }>,
  reply: FastifyReply,
): Promise<RespostaGravacao> {
  const r = await service.salvarAgenda(contextoDe(request), request.body);
  if (r.criado) reply.code(201);
  return r;
}

export async function bloquear(
  request: FastifyRequest<{ Body: EntradaBloqueio }>,
  reply: FastifyReply,
): Promise<RespostaMensagem> {
  const mensagem = await service.bloquearAgenda(
    contextoDe(request),
    request.body,
  );
  reply.code(201);
  return { mensagem };
}

export async function removerBloqueio(
  request: FastifyRequest<ComId>,
): Promise<RespostaMensagem> {
  await service.removerBloqueio(contextoDe(request), request.params.id);
  return { mensagem: "Bloqueio removido." };
}

export async function remarcarAgendamento(
  request: FastifyRequest<ComId & { Body: EntradaRemarcarAgendamento }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.remarcarAgendamento(
      contextoDe(request),
      request.params.id,
      request.body.horario,
    ),
  };
}

export async function cancelarAgendamento(
  request: FastifyRequest<ComId & { Body: EntradaCancelarAgendamento }>,
): Promise<RespostaMensagem> {
  await service.cancelarAgendamento(
    contextoDe(request),
    request.params.id,
    request.body.motivo,
  );
  return { mensagem: "Horário cancelado." };
}
