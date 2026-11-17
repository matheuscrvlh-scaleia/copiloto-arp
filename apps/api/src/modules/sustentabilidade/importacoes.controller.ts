import { dadosDe } from "@arp/shared/comercial/formato";
import type { FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import * as service from "./importacoes.service";
import * as acoes from "./importacoes-acoes.service";

// HTTP das importações do histórico. Sem regra e sem SQL.

type ComId = FastifyRequest<{ Params: { id: string } }>;

export async function lista(request: FastifyRequest) {
  return {
    importacoes: await service.importacoesSu(contextoDe(request)),
    dadosDe: dadosDe(new Date()),
  };
}

export function detalhe(request: ComId) {
  return acoes.detalheDaImportacao(contextoDe(request), request.params.id);
}

export function prepararEnvio(
  request: FastifyRequest<{
    Body: { tipo: string; nome: string; tamanho: number };
  }>,
) {
  return acoes.prepararEnvioImportacao(contextoDe(request), request.body);
}

export function lerEnvio(
  request: FastifyRequest<{
    Body: { tipo: string; caminho: string; nome: string; substituir?: boolean };
  }>,
) {
  return acoes.lerEnvioImportacao(contextoDe(request), request.body);
}

export async function descartarEnvio(
  request: FastifyRequest<{ Body: { caminho: string } }>,
) {
  await acoes.descartarEnvio(contextoDe(request), request.body);
  return { mensagem: "Envio descartado." };
}

export async function salvarEscolhas(
  request: FastifyRequest<{
    Params: { id: string };
    Body: { escolhas?: unknown };
  }>,
) {
  return {
    mensagem: await acoes.salvarEscolhasImportacao(
      contextoDe(request),
      request.params.id,
      request.body.escolhas,
    ),
  };
}

export async function confirmar(request: ComId) {
  return {
    mensagem: await acoes.confirmarImportacaoSu(
      contextoDe(request),
      request.params.id,
    ),
  };
}

export async function desfazer(request: ComId) {
  return {
    mensagem: await acoes.desfazerImportacaoSu(
      contextoDe(request),
      request.params.id,
    ),
  };
}
