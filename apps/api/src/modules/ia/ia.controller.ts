import { Readable } from "node:stream";
import type { RespostaMensagem } from "@arp/shared/contratos/auth";
import type {
  ConfigDaIa,
  ConsultaConversasDaEquipe,
  ConsultaDasConversas,
  ConsultaDoUso,
  EntradaLimite,
  EntradaPergunta,
  EventoDoAssistente,
  RespostaConfig,
  RespostaConversa,
  RespostaConversaDaEquipe,
  RespostaConversas,
  RespostaConversasDaEquipe,
  RespostaEstado,
  RespostaUso,
} from "@arp/shared/ia/contratos";
import type { FastifyReply, FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import * as assistente from "./assistente.service";
import * as gestao from "./gestao.service";

type ComId = { Params: { id: string } };

export function estado(request: FastifyRequest): Promise<RespostaEstado> {
  return assistente.estado(contextoDe(request));
}

async function* comoSse(
  eventos: AsyncGenerator<EventoDoAssistente>,
): AsyncGenerator<string> {
  for await (const e of eventos) yield `data: ${JSON.stringify(e)}\n\n`;
}

/** Resposta em text/event-stream: cada evento numa linha `data:`. */
export async function perguntar(
  request: FastifyRequest<{ Body: EntradaPergunta }>,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const parar = new AbortController();
  // A pessoa fechou o chat ou a aba: para de gerar (e de gastar tokens).
  reply.raw.on("close", () => {
    if (!reply.raw.writableFinished) parar.abort();
  });
  const eventos = await assistente.perguntar(
    contextoDe(request),
    request.body,
    parar.signal,
  );
  return reply
    .header("content-type", "text/event-stream; charset=utf-8")
    .header("x-accel-buffering", "no")
    .send(Readable.from(comoSse(eventos)));
}

export function conversas(
  request: FastifyRequest<{ Querystring: ConsultaDasConversas }>,
): Promise<RespostaConversas> {
  return assistente.conversas(contextoDe(request), request.query);
}

export function conversa(
  request: FastifyRequest<ComId>,
): Promise<RespostaConversa> {
  return assistente.conversa(contextoDe(request), request.params.id);
}

export async function apagarConversa(
  request: FastifyRequest<ComId>,
): Promise<RespostaMensagem> {
  await assistente.apagarConversa(contextoDe(request), request.params.id);
  return { mensagem: "Conversa apagada." };
}

export async function avaliar(
  request: FastifyRequest<ComId & { Body: { avaliacao: 1 | -1 | null } }>,
): Promise<RespostaMensagem> {
  await assistente.avaliar(
    contextoDe(request),
    request.params.id,
    request.body.avaliacao,
  );
  return { mensagem: "Obrigado pela avaliação." };
}

export function config(request: FastifyRequest): Promise<RespostaConfig> {
  return gestao.lerConfig(contextoDe(request));
}

export async function salvarConfig(
  request: FastifyRequest<{ Body: ConfigDaIa }>,
): Promise<RespostaMensagem> {
  await gestao.salvarConfig(contextoDe(request), request.body);
  return { mensagem: "Configuração salva." };
}

export async function salvarLimite(
  request: FastifyRequest<{ Body: EntradaLimite }>,
): Promise<RespostaMensagem> {
  await gestao.salvarLimite(contextoDe(request), request.body);
  return { mensagem: "Limite salvo." };
}

export async function removerLimite(
  request: FastifyRequest<{
    Params: { tipo: "cargo" | "usuario"; id: string };
  }>,
): Promise<RespostaMensagem> {
  await gestao.removerLimite(contextoDe(request), request.params);
  return { mensagem: "Limite removido." };
}

export function uso(
  request: FastifyRequest<{ Querystring: ConsultaDoUso }>,
): Promise<RespostaUso> {
  return gestao.uso(contextoDe(request), request.query);
}

export function conversasDaEquipe(
  request: FastifyRequest<{ Querystring: ConsultaConversasDaEquipe }>,
): Promise<RespostaConversasDaEquipe> {
  return gestao.conversasDaEquipe(contextoDe(request), request.query);
}

export function conversaDaEquipe(
  request: FastifyRequest<ComId>,
): Promise<RespostaConversaDaEquipe> {
  return gestao.conversaDaEquipe(contextoDe(request), request.params.id);
}
