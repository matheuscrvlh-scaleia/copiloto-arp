import type { FastifyRequest } from "fastify";
import { ErroDeNegocio, ErroNaoEncontrado } from "@/erros";
import { lerFormulario } from "@/http/formulario";
import { contextoDe } from "@/http/permissao";
import * as service from "./obras.service";
import * as acoes from "./obras-acoes.service";

// HTTP das Obras. Sem regra e sem SQL.

type ComId = { Params: { id: string } };

/** Formulário com um arquivo; maior que o limite vira a mensagem dada. */
async function formulario(request: FastifyRequest, grandeDemais: string) {
  try {
    return await lerFormulario(request, {
      arquivos: 1,
      bytesPorArquivo: acoes.LIMITE_BYTES,
    });
  } catch (e) {
    if (e instanceof Error && "statusCode" in e && e.statusCode === 413)
      throw new ErroDeNegocio(grandeDemais);
    throw e;
  }
}

export async function obras(request: FastifyRequest) {
  return { obras: await service.obrasComValores(contextoDe(request)) };
}

export async function paraImportar(request: FastifyRequest) {
  return { obras: await service.obrasParaImportar(contextoDe(request)) };
}

export async function diarioParaVincular(request: FastifyRequest) {
  return { obras: await service.obrasDoDiario(contextoDe(request)) };
}

export async function ligada(
  request: FastifyRequest<{ Params: { diarioObraId: string } }>,
) {
  return {
    obra: await service.obraLigadaAoDiario(
      contextoDe(request),
      request.params.diarioObraId,
    ),
  };
}

export async function obra(request: FastifyRequest<ComId>) {
  const d = await service.dadosDaObra(contextoDe(request), request.params.id);
  if (!d) throw new ErroNaoEncontrado();
  return d;
}

export async function salvarObra(
  request: FastifyRequest<ComId & { Body: Record<string, unknown> }>,
) {
  return {
    mensagem: await acoes.salvarObra(
      contextoDe(request),
      request.params.id,
      request.body,
    ),
  };
}

export async function lerOrcamento(request: FastifyRequest) {
  const form = await formulario(
    request,
    `A planilha passa de ${acoes.LIMITE_MB} MB.`,
  );
  const arquivo = form.arquivos.find((a) => a.campo === "arquivo");
  return acoes.lerPlanilhaOrcamento(
    contextoDe(request),
    form.campos,
    arquivo ? { nome: arquivo.nome, bytes: arquivo.bytes } : null,
  );
}

export function confirmarOrcamento(request: FastifyRequest<ComId>) {
  return acoes.confirmarOrcamento(contextoDe(request), request.params.id);
}

export function descartarOrcamento(request: FastifyRequest<ComId>) {
  return acoes.descartarOrcamento(contextoDe(request), request.params.id);
}

export async function salvarRealizado(request: FastifyRequest) {
  const form = await formulario(
    request,
    `Anexo: passa de ${acoes.LIMITE_MB} MB.`,
  );
  const anexo = form.arquivos.find((a) => a.campo === "anexo");
  return {
    mensagem: await acoes.salvarRealizado(
      contextoDe(request),
      form.campos,
      anexo ? { nome: anexo.nome, bytes: anexo.bytes } : null,
    ),
  };
}

export async function excluirRealizado(request: FastifyRequest<ComId>) {
  return {
    mensagem: await acoes.excluirRealizado(
      contextoDe(request),
      request.params.id,
    ),
  };
}
