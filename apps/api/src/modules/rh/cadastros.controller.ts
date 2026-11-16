import type { RespostaMensagem } from "@arp/shared/contratos/auth";
import type { CorpoDoFormulario } from "@arp/shared/rh/contratos/cadastros";
import type { FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import * as service from "./cadastros.service";

type ComCorpo = FastifyRequest<{ Body: CorpoDoFormulario }>;

export const cadastros = (request: FastifyRequest) =>
  service.cadastros(contextoDe(request));

export async function salvarDepartamento(
  request: FastifyRequest<{ Params: { id: string }; Body: CorpoDoFormulario }>,
): Promise<RespostaMensagem> {
  await service.salvarDepartamento(contextoDe(request), {
    ...request.body,
    id: request.params.id,
  });
  return { mensagem: "Salvo." };
}

export async function trocarGrupoRubrica(
  request: ComCorpo,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.trocarGrupoRubrica(
      contextoDe(request),
      request.body,
    ),
  };
}

export async function salvarFinanceiro(
  request: ComCorpo,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.salvarFinanceiro(contextoDe(request), request.body),
  };
}

export async function salvarJornada(
  request: ComCorpo,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.salvarJornada(contextoDe(request), request.body),
  };
}

export async function removerJornada(
  request: FastifyRequest<{ Params: { alvo: string } }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.removerJornada(
      contextoDe(request),
      request.params.alvo,
    ),
  };
}

export async function salvarMeta(request: ComCorpo): Promise<RespostaMensagem> {
  await service.salvarMeta(contextoDe(request), request.body);
  return { mensagem: "Salvo." };
}

export async function salvarEmpresa(
  request: ComCorpo,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.salvarEmpresa(contextoDe(request), request.body),
  };
}

export async function salvarEncargos(
  request: ComCorpo,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.salvarEncargos(contextoDe(request), request.body),
  };
}
