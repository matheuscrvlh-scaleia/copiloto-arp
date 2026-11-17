import type {
  CamposDeFormulario,
  ConsultaDaTelaDeParametros,
} from "@arp/shared/sustentabilidade/contratos/parametros";
import type { FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import * as service from "./parametros.service";

// HTTP de Configurações › Parâmetros e › Coletores. Sem regra e sem SQL.

type Gravacao = FastifyRequest<{ Body: CamposDeFormulario }>;

export function tela(
  request: FastifyRequest<{ Querystring: ConsultaDaTelaDeParametros }>,
) {
  return service.telaDeParametros(contextoDe(request), request.query);
}

export async function salvarParametros(request: Gravacao) {
  return {
    mensagem: await service.salvarParametros(contextoDe(request), request.body),
  };
}

export async function salvarValidadesPorSetor(request: Gravacao) {
  return {
    mensagem: await service.salvarValidadesPorSetor(
      contextoDe(request),
      request.body,
    ),
  };
}

export async function salvarMarcos(request: Gravacao) {
  return {
    mensagem: await service.salvarMarcos(contextoDe(request), request.body),
  };
}

export async function salvarEquivalencias(request: Gravacao) {
  return {
    mensagem: await service.salvarEquivalencias(
      contextoDe(request),
      request.body,
    ),
  };
}

export async function salvarMetas(request: Gravacao) {
  return {
    mensagem: await service.salvarMetas(contextoDe(request), request.body),
  };
}

export async function novaVigenciaRcc(request: Gravacao) {
  return {
    mensagem: await service.novaVigenciaRcc(contextoDe(request), request.body),
  };
}

export async function novaVigenciaCo2(request: Gravacao) {
  return {
    mensagem: await service.novaVigenciaCo2(contextoDe(request), request.body),
  };
}

export async function removerExemplos(request: FastifyRequest) {
  return { mensagem: await service.removerExemplos(contextoDe(request)) };
}

export async function salvarColetor(request: Gravacao) {
  return {
    mensagem: await service.salvarColetor(contextoDe(request), request.body),
  };
}

export async function excluirColetor(
  request: FastifyRequest<{ Params: { id: string } }>,
) {
  return {
    mensagem: await service.excluirColetor(
      contextoDe(request),
      request.params.id,
    ),
  };
}
