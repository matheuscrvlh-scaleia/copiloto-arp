import type { RespostaMensagem } from "@arp/shared/comercial/contratos/base";
import type {
  EntradaMetas,
  RespostaMetas,
  RespostaPainel,
} from "@arp/shared/comercial/contratos/painel";
import type { FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import * as service from "./painel.service";

export function painel(
  request: FastifyRequest<{ Querystring: { ano?: number } }>,
): Promise<RespostaPainel> {
  return service.dadosDoPainel(contextoDe(request), request.query.ano);
}

export function metas(request: FastifyRequest): Promise<RespostaMetas> {
  return service.metas(contextoDe(request));
}

export async function salvarMetas(
  request: FastifyRequest<{ Body: EntradaMetas }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.salvarMetas(contextoDe(request), request.body),
  };
}
