import type { RespostaMensagem } from "@arp/shared/contratos/auth";
import type { FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import * as service from "./banco-horas.service";

export const fechamento = (
  request: FastifyRequest<{ Querystring: { aba?: string; ciclo?: string } }>,
) => service.fechamento(contextoDe(request), request.query);

export async function fecharCiclo(
  request: FastifyRequest<{ Body: { refazer?: string } }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.fecharCiclo(
      contextoDe(request),
      request.body.refazer === "1",
    ),
  };
}

export async function salvarFechamento(
  request: FastifyRequest<{
    Params: { id: string };
    Body: Record<string, string>;
  }>,
): Promise<RespostaMensagem> {
  await service.salvarFechamento(
    contextoDe(request),
    request.params.id,
    request.body,
  );
  return { mensagem: "Fechamento salvo." };
}

export async function finalizarCiclo(
  request: FastifyRequest<{ Params: { id: string } }>,
): Promise<RespostaMensagem> {
  await service.finalizarCiclo(contextoDe(request), request.params.id);
  return {
    mensagem: "Ciclo finalizado. O próximo ciclo já está nos Parâmetros.",
  };
}
