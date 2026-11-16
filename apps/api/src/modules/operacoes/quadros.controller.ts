import type { FastifyReply, FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import * as service from "./quadros.service";

// HTTP dos quadros de medidores e do termo de energia. Sem regra e sem SQL.

type ComId = { Params: { id: string } };
type Formulario = Record<string, unknown>;

export async function quadros(request: FastifyRequest) {
  return service.quadros(contextoDe(request));
}

export async function caixas(
  request: FastifyRequest<{ Querystring: { quadro?: string } }>,
) {
  return {
    caixas: await service.caixas(contextoDe(request), request.query.quadro),
  };
}

export async function salas(request: FastifyRequest) {
  return { salas: await service.salas(contextoDe(request)) };
}

export async function fotos(request: FastifyRequest<ComId>) {
  return {
    fotos: await service.fotosDoQuadro(contextoDe(request), request.params.id),
  };
}

export function ficha(request: FastifyRequest<ComId>) {
  return service.fichaDaCaixa(contextoDe(request), request.params.id);
}

export async function termosRecentes(request: FastifyRequest) {
  return { termos: await service.termosRecentes(contextoDe(request)) };
}

/** Manda para o link assinado do arquivo (dois minutos). */
export async function baixarTermo(
  request: FastifyRequest<ComId & { Querystring: { formato?: string } }>,
  reply: FastifyReply,
) {
  const url = await service.linkDoTermo(
    contextoDe(request),
    request.params.id,
    request.query.formato === "docx" ? "docx" : "pdf",
  );
  return reply.header("Cache-Control", "no-store").redirect(url, 302);
}

export function salvarQuadro(request: FastifyRequest<{ Body: Formulario }>) {
  return service.salvarQuadro(contextoDe(request), request.body);
}

export function salvarCaixa(request: FastifyRequest<{ Body: Formulario }>) {
  return service.salvarCaixa(contextoDe(request), request.body);
}

export async function trocarLocatario(
  request: FastifyRequest<ComId & { Body: Formulario }>,
) {
  return {
    mensagem: await service.trocarLocatario(
      contextoDe(request),
      request.params.id,
      request.body,
    ),
  };
}

export async function atualizarDoEnet(request: FastifyRequest<ComId>) {
  return {
    mensagem: await service.atualizarDoEnet(
      contextoDe(request),
      request.params.id,
    ),
  };
}

export async function liberarCaixa(
  request: FastifyRequest<ComId & { Body: Formulario }>,
) {
  return {
    mensagem: await service.liberarCaixa(
      contextoDe(request),
      request.params.id,
      request.body,
    ),
  };
}

export async function emitirTermo(
  request: FastifyRequest<ComId & { Body: Formulario }>,
) {
  return {
    mensagem: await service.emitirTermo(
      contextoDe(request),
      request.params.id,
      request.body,
    ),
  };
}

export function prepararFoto(
  request: FastifyRequest<ComId & { Body: { nome: string; tamanho: number } }>,
) {
  return service.prepararFoto(
    contextoDe(request),
    request.params.id,
    request.body,
  );
}

export async function registrarFoto(
  request: FastifyRequest<ComId & { Body: { caminho: string } }>,
) {
  return {
    mensagem: await service.registrarFoto(
      contextoDe(request),
      request.params.id,
      request.body.caminho,
    ),
  };
}

export async function removerFoto(
  request: FastifyRequest<ComId & { Querystring: { caminho: string } }>,
) {
  return {
    mensagem: await service.removerFoto(
      contextoDe(request),
      request.params.id,
      request.query.caminho,
    ),
  };
}
