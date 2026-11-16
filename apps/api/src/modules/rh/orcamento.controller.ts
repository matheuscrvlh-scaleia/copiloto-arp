import type { RespostaMensagem } from "@arp/shared/contratos/auth";
import type { CorpoDoFormulario } from "@arp/shared/rh/contratos/cadastros";
import type { ConsultaDoOrcamento } from "@arp/shared/rh/contratos/orcamento";
import type { FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import * as service from "./orcamento.service";

type ComId = { Params: { id: string } };

export const tela = (
  request: FastifyRequest<{ Querystring: ConsultaDoOrcamento }>,
) => service.tela(contextoDe(request), request.query);

export async function salvarGasto(
  request: FastifyRequest<{ Body: CorpoDoFormulario }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.salvarGasto(contextoDe(request), request.body),
  };
}

export async function excluirGasto(
  request: FastifyRequest<ComId>,
): Promise<RespostaMensagem> {
  await service.excluirGasto(contextoDe(request), request.params.id);
  return { mensagem: "Gasto excluído." };
}

export async function finalizar(
  request: FastifyRequest<{ Params: { ano: number } }>,
): Promise<RespostaMensagem> {
  await service.finalizar(contextoDe(request), request.params.ano);
  return { mensagem: `Orçamento de ${request.params.ano} finalizado.` };
}

export async function categorias(request: FastifyRequest) {
  return { categorias: await service.categorias(contextoDe(request)) };
}

export async function salvarCategoria(
  request: FastifyRequest<{ Body: CorpoDoFormulario }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.salvarCategoria(contextoDe(request), request.body),
  };
}

export async function trocarAtiva(
  request: FastifyRequest<ComId & { Body: { ativa: string } }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.trocarAtiva(
      contextoDe(request),
      request.params.id,
      request.body.ativa === "true",
    ),
  };
}
