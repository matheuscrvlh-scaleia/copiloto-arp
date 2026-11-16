import type {
  CategoriaDoFormulario,
  ConsultaInicial,
  DadosDoFormulario,
  EntradaCategoriaRapida,
  EntradaLembrarFiltros,
  EntradaTerceirizadoRapido,
  HorariosDoDia,
  InicialDoFormulario,
  OpcoesDeVinculo,
  RespostaApoio,
  RespostaMensagem,
} from "@arp/shared/os/contratos/base";
import type { Tela } from "@arp/shared/os/lista";
import type { FastifyReply, FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import { horariosDoDia } from "./agenda.service";
import { lerApoio } from "./base.service";
import * as service from "./formulario.service";
import * as preferencias from "./visoes-acoes.service";

// HTTP da base do Tickets: lê a requisição validada e chama o service.

export function apoio(request: FastifyRequest): Promise<RespostaApoio> {
  return lerApoio(contextoDe(request));
}

export function formulario(
  request: FastifyRequest,
): Promise<DadosDoFormulario> {
  return service.dadosDoFormulario(contextoDe(request));
}

export function inicial(
  request: FastifyRequest<{ Querystring: ConsultaInicial }>,
): Promise<InicialDoFormulario> {
  const { os, ...busca } = request.query;
  return service.inicialDoFormulario(contextoDe(request), busca, os === "1");
}

export function vinculos(request: FastifyRequest): Promise<OpcoesDeVinculo> {
  return service.opcoesDeVinculo(contextoDe(request));
}

export function horarios(
  request: FastifyRequest<{
    Params: { id: string };
    Querystring: { data: string };
  }>,
): Promise<HorariosDoDia> {
  return horariosDoDia(
    contextoDe(request),
    request.params.id,
    request.query.data,
  );
}

export async function criarCategoria(
  request: FastifyRequest<{ Body: EntradaCategoriaRapida }>,
  reply: FastifyReply,
): Promise<{ categoria: CategoriaDoFormulario }> {
  const categoria = await service.criarCategoriaRapida(
    contextoDe(request),
    request.body,
  );
  reply.code(201);
  return { categoria };
}

export async function criarTerceirizado(
  request: FastifyRequest<{ Body: EntradaTerceirizadoRapido }>,
  reply: FastifyReply,
): Promise<RespostaMensagem> {
  const mensagem = await service.criarTerceirizadoRapido(
    contextoDe(request),
    request.body,
  );
  reply.code(201);
  return { mensagem };
}

export async function lembrarFiltros(
  request: FastifyRequest<{
    Params: { tela: Tela };
    Body: EntradaLembrarFiltros;
  }>,
): Promise<RespostaMensagem> {
  await preferencias.lembrarFiltros(
    contextoDe(request),
    request.params.tela,
    request.body.valores,
  );
  return { mensagem: "" };
}

export async function seuDiaVisto(
  request: FastifyRequest,
): Promise<RespostaMensagem> {
  await preferencias.marcarSeuDiaVisto(contextoDe(request));
  return { mensagem: "" };
}
