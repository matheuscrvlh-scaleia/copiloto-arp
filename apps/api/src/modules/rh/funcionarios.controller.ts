import type { RespostaMensagem } from "@arp/shared/contratos/auth";
import type { ConsultaDoPeriodo } from "@arp/shared/rh/contratos/comum";
import type { RespostaPerfil } from "@arp/shared/rh/contratos/funcionarios";
import type { FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import * as service from "./funcionarios.service";

export async function listar(request: FastifyRequest) {
  return { funcionarios: await service.listar(contextoDe(request)) };
}

export function perfil(
  request: FastifyRequest<{
    Params: { id: string };
    Querystring: ConsultaDoPeriodo;
  }>,
): Promise<RespostaPerfil> {
  return service.perfil(contextoDe(request), request.params.id, request.query);
}

export async function marcarForaDoPonto(
  request: FastifyRequest<{
    Params: { id: string };
    Body: { fora: "sim" | "nao" };
  }>,
): Promise<RespostaMensagem> {
  const mensagem = await service.marcarForaDoPonto(
    contextoDe(request),
    request.params.id,
    request.body.fora === "sim",
  );
  return { mensagem };
}
