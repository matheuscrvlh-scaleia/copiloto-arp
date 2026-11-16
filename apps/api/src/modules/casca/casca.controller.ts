import type { RespostaMensagem } from "@arp/shared/contratos/auth";
import type {
  EntradaFiltros,
  ParametrosDosFiltros,
  RespostaAvisos,
  RespostaFiltros,
  RespostaNotificacoes,
} from "@arp/shared/contratos/casca";
import type { FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import * as service from "./casca.service";

export async function avisos(request: FastifyRequest): Promise<RespostaAvisos> {
  return { avisos: await service.avisosDo(contextoDe(request)) };
}

export async function notificacoes(
  request: FastifyRequest,
): Promise<RespostaNotificacoes> {
  return {
    notificacoes: await service.minhasNotificacoes(contextoDe(request)),
  };
}

export async function marcarLida(
  request: FastifyRequest<{ Params: { id: number } }>,
): Promise<RespostaMensagem> {
  await service.marcarNotificacaoLida(contextoDe(request), request.params.id);
  return { mensagem: "Marcada como lida." };
}

export async function marcarTodasLidas(
  request: FastifyRequest,
): Promise<RespostaMensagem> {
  await service.marcarTodasLidas(contextoDe(request));
  return { mensagem: "Marcadas como lidas." };
}

export async function filtros(
  request: FastifyRequest<{ Params: ParametrosDosFiltros }>,
): Promise<RespostaFiltros> {
  const { modulo, tela } = request.params;
  return {
    query: await service.filtrosLembrados(contextoDe(request), modulo, tela),
  };
}

export async function lembrarFiltros(
  request: FastifyRequest<{
    Params: ParametrosDosFiltros;
    Body: EntradaFiltros;
  }>,
): Promise<RespostaMensagem> {
  const { modulo, tela } = request.params;
  await service.lembrarFiltros(
    contextoDe(request),
    modulo,
    tela,
    request.body.query,
  );
  return { mensagem: "Salvo." };
}
