import type { RespostaMensagem } from "@arp/shared/comercial/contratos/base";
import type { Formulario } from "@arp/shared/comercial/contratos/configuracoes";
import type {
  ConsultaFichas,
  EntradaFichaPublica,
  EstadoDaFicha,
  EstadoDoDocumento,
  RespostaDemonstracaoFicha,
  RespostaDetalheFicha,
  RespostaFichaPublica,
  RespostaFichas,
  RespostaLinkFicha,
} from "@arp/shared/comercial/contratos/fichas";
import type { FastifyReply, FastifyRequest } from "fastify";
import { lerFormulario } from "@/http/formulario";
import { contextoDe, origemDe } from "@/http/permissao";
import { disposicao } from "@/infra/arquivos/http";
import * as publica from "./ficha-publica.service";
import * as service from "./fichas.service";

type ComId = { Params: { id: string } };
type ComToken = { Params: { token: string } };

export function lista(
  request: FastifyRequest<{ Querystring: ConsultaFichas }>,
): Promise<RespostaFichas> {
  return service.lista(contextoDe(request), request.query);
}

export function demonstracao(
  request: FastifyRequest,
): Promise<RespostaDemonstracaoFicha> {
  return service.demonstracao(contextoDe(request));
}

export function detalhe(
  request: FastifyRequest<ComId>,
): Promise<RespostaDetalheFicha> {
  return service.detalhe(contextoDe(request), request.params.id);
}

export async function pdf(request: FastifyRequest<ComId>, reply: FastifyReply) {
  const { bytes, nome } = await service.pdf(
    contextoDe(request),
    request.params.id,
  );
  return reply
    .header("content-type", "application/pdf")
    .header("content-disposition", disposicao("attachment", nome))
    .header("cache-control", "private, no-store")
    .send(Buffer.from(bytes));
}

/** Documento comprobatório: redireciona para o link assinado (5 min). */
export async function documento(
  request: FastifyRequest<{ Params: { id: string; doc: string } }>,
  reply: FastifyReply,
) {
  const link = await service.linkDoDocumento(
    contextoDe(request),
    request.params.id,
    request.params.doc,
  );
  return reply.redirect(link, 302);
}

export function gerarLink(
  request: FastifyRequest<{ Body: Formulario }>,
): Promise<RespostaLinkFicha> {
  return service.gerarLink(contextoDe(request), request.body);
}

export function reenviar(
  request: FastifyRequest<ComId>,
): Promise<RespostaLinkFicha> {
  return service.reenviar(contextoDe(request), request.params.id);
}

export async function cancelar(
  request: FastifyRequest<ComId>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.cancelar(contextoDe(request), request.params.id),
  };
}

// ---------------------------------------------------------------------------
// Pelo link (sem login)
// ---------------------------------------------------------------------------

export function paginaPublica(
  request: FastifyRequest<ComToken>,
  reply: FastifyReply,
): Promise<RespostaFichaPublica> {
  reply.header("cache-control", "private, no-store");
  return publica.pagina(request.params.token);
}

export function salvarPublica(
  request: FastifyRequest<ComToken & { Body: EntradaFichaPublica }>,
): Promise<EstadoDaFicha> {
  return publica.salvar(request.params.token, request.body);
}

export async function enviarDocumento(
  request: FastifyRequest<ComToken>,
): Promise<EstadoDoDocumento> {
  // Um pouco acima do limite: quem passa recebe a mensagem do service.
  const form = await lerFormulario(request, {
    arquivos: 1,
    bytesPorArquivo: (publica.LIMITE_MB + 1) * 1024 * 1024,
  });
  return publica.enviarDocumento(
    request.params.token,
    form.campos,
    form.arquivos.find((a) => a.campo === "arquivo"),
  );
}

export function removerDocumento(
  request: FastifyRequest<{ Params: { token: string; id: string } }>,
): Promise<EstadoDoDocumento> {
  return publica.removerDocumento(request.params.token, request.params.id);
}

export async function cep(
  request: FastifyRequest<{ Params: { token: string; valor: string } }>,
) {
  return {
    endereco: await publica.consultarCep(
      request.params.token,
      request.params.valor,
      origemDe(request),
    ),
  };
}

export async function cnpj(
  request: FastifyRequest<{ Params: { token: string; valor: string } }>,
) {
  return {
    empresa: await publica.consultarCnpj(
      request.params.token,
      request.params.valor,
      origemDe(request),
    ),
  };
}
