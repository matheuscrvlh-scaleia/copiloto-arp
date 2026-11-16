import type { FastifyReply, FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import { disposicao } from "@/infra/arquivos/http";
import { TIPO_XLSX } from "@/infra/planilha";
import * as service from "./limpeza.service";
import * as acoes from "./limpeza-acoes.service";

// HTTP do rateio da limpeza. Sem regra e sem SQL.

type ComMes = { Params: { mes: string } };
type ComId = { Params: { id: string } };

export async function meses(request: FastifyRequest) {
  return { meses: await service.mesesDaTela(contextoDe(request)) };
}

export async function mes(request: FastifyRequest<ComMes>) {
  return {
    detalhe: await service.mesDaTela(contextoDe(request), request.params.mes),
  };
}

export async function demonstrativo(
  request: FastifyRequest<ComMes & { Querystring: { bloco?: string } }>,
  reply: FastifyReply,
) {
  const { pdf, nome } = await service.demonstrativo(
    contextoDe(request),
    request.params.mes,
    request.query.bloco,
  );
  return reply
    .header("content-type", "application/pdf")
    .header("content-disposition", disposicao("inline", nome))
    .header("cache-control", "private, no-store")
    .send(Buffer.from(pdf));
}

export async function planilha(
  request: FastifyRequest<ComMes>,
  reply: FastifyReply,
) {
  const { bytes, nome } = await service.planilha(
    contextoDe(request),
    request.params.mes,
  );
  return reply
    .header("content-type", TIPO_XLSX)
    .header("content-disposition", disposicao("attachment", nome))
    .header("cache-control", "private, no-store")
    .send(Buffer.from(bytes));
}

export function mesAnterior(request: FastifyRequest<ComMes>) {
  return acoes.lancamentoDoMesAnterior(contextoDe(request), request.params.mes);
}

export function criarMes(
  request: FastifyRequest<{ Body: { referencia: string; copiar: boolean } }>,
) {
  return acoes.criarMes(contextoDe(request), request.body);
}

export async function salvar(
  request: FastifyRequest<ComMes & { Body: Record<string, unknown> }>,
) {
  return {
    mensagem: await acoes.salvarRateio(
      contextoDe(request),
      request.params.mes,
      request.body,
    ),
  };
}

export async function fechar(request: FastifyRequest<ComMes>) {
  return {
    mensagem: await acoes.fecharRateio(contextoDe(request), request.params.mes),
  };
}

export async function reabrir(
  request: FastifyRequest<ComMes & { Body: { motivo: string } }>,
) {
  return {
    mensagem: await acoes.reabrirRateio(
      contextoDe(request),
      request.params.mes,
      request.body.motivo,
    ),
  };
}

export async function enviar(request: FastifyRequest<ComMes>) {
  return {
    mensagem: await acoes.enviarRateio(contextoDe(request), request.params.mes),
  };
}

export function prepararAnexo(
  request: FastifyRequest<
    ComMes & { Body: { tipo: string; nome: string; tamanho: number } }
  >,
) {
  return acoes.prepararAnexoRateio(contextoDe(request), {
    ...request.body,
    referencia: request.params.mes,
  });
}

export async function registrarAnexo(
  request: FastifyRequest<
    ComMes & { Body: { tipo: string; caminho: string; nome: string } }
  >,
) {
  return {
    mensagem: await acoes.registrarAnexoRateio(contextoDe(request), {
      ...request.body,
      referencia: request.params.mes,
    }),
  };
}

export async function removerAnexo(request: FastifyRequest<ComId>) {
  return {
    mensagem: await acoes.removerAnexoRateio(
      contextoDe(request),
      request.params.id,
    ),
  };
}

export async function linkDoAnexo(request: FastifyRequest<ComId>) {
  return {
    url: await acoes.linkDoAnexoRateio(contextoDe(request), request.params.id),
  };
}

export function prepararHistorico(
  request: FastifyRequest<{ Body: { nome: string; tamanho: number } }>,
) {
  return acoes.prepararEnvioHistorico(contextoDe(request), request.body);
}

export async function previaHistorico(
  request: FastifyRequest<{ Body: { caminho: string; nome: string } }>,
) {
  return {
    previa: await acoes.previaHistorico(contextoDe(request), request.body),
  };
}

export async function previaAbertaHistorico(request: FastifyRequest) {
  return { previa: await acoes.previaAbertaHistorico(contextoDe(request)) };
}

export async function confirmarHistorico(
  request: FastifyRequest<ComId & { Body: { motivo?: string } }>,
) {
  return {
    mensagem: await acoes.confirmarHistorico(
      contextoDe(request),
      request.params.id,
      request.body.motivo,
    ),
  };
}

export async function descartarHistorico(request: FastifyRequest<ComId>) {
  return {
    mensagem: await acoes.descartarHistorico(
      contextoDe(request),
      request.params.id,
    ),
  };
}
