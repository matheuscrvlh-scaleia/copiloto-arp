import type { RespostaMensagem } from "@arp/shared/contratos/auth";
import type { ConsultaDoCusto } from "@arp/shared/rh/contratos/custo";
import type { FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import * as service from "./custo-de-pessoal.service";

type ComConsulta = FastifyRequest<{ Querystring: ConsultaDoCusto }>;

export const dashboard = (request: ComConsulta) =>
  service.dashboard(contextoDe(request), request.query);

export const comparacao = (request: ComConsulta) =>
  service.comparacao(contextoDe(request), request.query);

export async function recalcular(
  request: FastifyRequest,
): Promise<RespostaMensagem> {
  return { mensagem: await service.recalcular(contextoDe(request)) };
}
