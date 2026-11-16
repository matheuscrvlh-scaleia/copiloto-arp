import type { RespostaMensagem } from "@arp/shared/os/contratos/base";
import type {
  ConsultaDaLista,
  ConsultaDoQuadro,
  EntradaAtribuir,
  EntradaMover,
  EntradaPrazo,
  EntradaPrioridade,
  EntradaReabrir,
  Planilha,
  RespostaCalendario,
  RespostaLista,
  RespostaQuadro,
  RespostaSeuDia,
} from "@arp/shared/os/contratos/visoes";
import type { FastifyRequest } from "fastify";
import type { Contexto } from "@/contexto";
import { ErroDePermissao } from "@/erros";
import { contextoDe } from "@/http/permissao";
import * as service from "./visoes.service";
import * as acoes from "./visoes-acoes.service";

// HTTP das visões do dia a dia: lê a requisição validada e chama o service.

type ComId = { Params: { id: string } };

/** O Geral (dos chamados e das OS) é de quem tem os.meu_setor, como a tela. */
function contextoDaLista(
  request: FastifyRequest<{ Querystring: ConsultaDaLista }>,
): Contexto {
  const ctx = contextoDe(request);
  const { tela } = request.query;
  if (
    (tela === "setor" || tela === "os_setor") &&
    !ctx.permissoes.has("os.meu_setor")
  )
    throw new ErroDePermissao();
  return ctx;
}

export function lista(
  request: FastifyRequest<{ Querystring: ConsultaDaLista }>,
): Promise<RespostaLista> {
  const { tela, ...busca } = request.query;
  return service.lerLista(contextoDaLista(request), tela, busca);
}

export function exportarLista(
  request: FastifyRequest<{ Querystring: ConsultaDaLista }>,
): Promise<Planilha> {
  const { tela, ...busca } = request.query;
  return service.exportarLista(contextoDaLista(request), tela, busca);
}

export function quadro(
  request: FastifyRequest<{ Querystring: ConsultaDoQuadro }>,
): Promise<RespostaQuadro> {
  const { ordens, ...busca } = request.query;
  return service.lerQuadro(contextoDe(request), busca, ordens === "1");
}

export function exportarQuadro(
  request: FastifyRequest<{ Querystring: ConsultaDoQuadro }>,
): Promise<Planilha> {
  const { ordens, ...busca } = request.query;
  return service.exportarQuadro(contextoDe(request), busca, ordens === "1");
}

export function calendario(
  request: FastifyRequest<{ Querystring: Record<string, unknown> }>,
): Promise<RespostaCalendario> {
  return service.lerCalendario(contextoDe(request), request.query);
}

export function seuDia(request: FastifyRequest): Promise<RespostaSeuDia> {
  return service.seuDia(contextoDe(request));
}

export async function atribuir(
  request: FastifyRequest<{ Body: EntradaAtribuir }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await acoes.atribuirResponsavel(
      contextoDe(request),
      request.body,
    ),
  };
}

export async function prazo(
  request: FastifyRequest<{ Body: EntradaPrazo }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await acoes.mudarPrazo(contextoDe(request), request.body),
  };
}

export async function prioridade(
  request: FastifyRequest<{ Body: EntradaPrioridade }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await acoes.mudarPrioridade(contextoDe(request), request.body),
  };
}

export async function confirmar(
  request: FastifyRequest<ComId>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await acoes.confirmarChamado(
      contextoDe(request),
      request.params.id,
    ),
  };
}

export async function reabrir(
  request: FastifyRequest<ComId & { Body: EntradaReabrir }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await acoes.reabrirChamado(
      contextoDe(request),
      request.params.id,
      request.body.motivo,
    ),
  };
}

export async function mover(
  request: FastifyRequest<ComId & { Body: EntradaMover }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await acoes.moverChamado(
      contextoDe(request),
      request.params.id,
      request.body,
    ),
  };
}
