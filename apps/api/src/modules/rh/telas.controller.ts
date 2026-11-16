import type {
  ConsultaDoPeriodo,
  PedidoDoQuadro,
} from "@arp/shared/rh/contratos/comum";
import type { FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import * as detalhes from "./detalhes.service";
import * as jornadaService from "./jornada.service";
import * as painelService from "./painel.service";
import * as parametrosService from "./parametros.service";
import * as quadroService from "./quadro.service";

type ComPeriodo = FastifyRequest<{ Querystring: ConsultaDoPeriodo }>;

export const painel = (request: ComPeriodo) =>
  painelService.painel(contextoDe(request), request.query);

export const quadro = (request: ComPeriodo) =>
  quadroService.quadro(contextoDe(request), request.query);

export const jornada = (request: ComPeriodo) =>
  jornadaService.jornada(contextoDe(request), request.query);

export const parametros = (request: FastifyRequest) =>
  parametrosService.parametros(contextoDe(request));

export async function tabelasDoQuadro(
  request: FastifyRequest<{ Querystring: PedidoDoQuadro }>,
) {
  return {
    tabelas: await detalhes.tabelasDoQuadro(contextoDe(request), request.query),
  };
}

export async function tabelasDaMemoria(
  request: FastifyRequest<{
    Querystring: { competencia: string; colaborador: string };
  }>,
) {
  return {
    tabelas: await detalhes.tabelasDaMemoriaDoCusto(
      contextoDe(request),
      request.query.competencia,
      request.query.colaborador,
    ),
  };
}
