import type { RespostaMensagem } from "@arp/shared/comercial/contratos/base";
import type { Formulario } from "@arp/shared/comercial/contratos/configuracoes";
import type {
  EntradaArquivoKit,
  EntradaNovoDocumentoKit,
  RespostaDocumentoKit,
  RespostaKit,
} from "@arp/shared/comercial/contratos/kit";
import type { FastifyReply, FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import { disposicao } from "@/infra/arquivos/http";
import * as service from "./kit.service";

type ComId = { Params: { id: string } };

export function tela(request: FastifyRequest): Promise<RespostaKit> {
  return service.tela(contextoDe(request));
}

export function documento(
  request: FastifyRequest<ComId>,
): Promise<RespostaDocumentoKit> {
  return service.documento(contextoDe(request), request.params.id);
}

/** Baixar uma versão: redireciona para o link assinado (60 s). */
export async function arquivo(
  request: FastifyRequest<ComId>,
  reply: FastifyReply,
) {
  const link = await service.linkDaVersao(
    contextoDe(request),
    request.params.id,
  );
  return reply.redirect(link, 302);
}

export async function kitDoLuc(
  request: FastifyRequest<{ Querystring: { luc: string } }>,
  reply: FastifyReply,
) {
  const { bytes, nome } = await service.pdfDoLuc(
    contextoDe(request),
    request.query.luc,
  );
  return reply
    .header("content-type", "application/pdf")
    .header("content-disposition", disposicao("attachment", nome))
    .header("cache-control", "private, no-store")
    .send(Buffer.from(bytes));
}

export async function novoDocumento(
  request: FastifyRequest<{ Body: EntradaNovoDocumentoKit }>,
  reply: FastifyReply,
) {
  const r = await service.novoDocumento(contextoDe(request), request.body);
  reply.code(201);
  return { mensagem: "Documento cadastrado no kit.", ...r };
}

export function prepararEnvio(
  request: FastifyRequest<ComId & { Body: { nome: string; tamanho: number } }>,
) {
  return service.prepararEnvioKit(
    contextoDe(request),
    request.params.id,
    request.body.nome,
    request.body.tamanho,
  );
}

export async function registrarArquivo(
  request: FastifyRequest<ComId & { Body: EntradaArquivoKit }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.registrarArquivo(
      contextoDe(request),
      request.params.id,
      request.body,
    ),
  };
}

export async function editarDocumento(
  request: FastifyRequest<ComId & { Body: Formulario }>,
): Promise<RespostaMensagem> {
  await service.editarDocumento(
    contextoDe(request),
    request.params.id,
    request.body,
  );
  return { mensagem: "Documento salvo." };
}
