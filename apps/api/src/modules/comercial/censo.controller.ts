import type { RespostaMensagem } from "@arp/shared/comercial/contratos/base";
import type {
  ConviteCenso,
  RespostaCenso,
  RespostaCensoPublico,
  RespostaFeedbacksCenso,
  RespostaIndicadoresCenso,
  RespostaRodadaCenso,
} from "@arp/shared/comercial/contratos/censo";
import type { Formulario } from "@arp/shared/comercial/contratos/configuracoes";
import type { FastifyReply, FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import { disposicao } from "@/infra/arquivos/http";
import * as service from "./censo.service";

type ComId = { Params: { id: string } };
type ComForm = { Body: Formulario };

const mensagem = async (p: Promise<string>): Promise<RespostaMensagem> => ({
  mensagem: await p,
});

export function tela(request: FastifyRequest): Promise<RespostaCenso> {
  return service.tela(contextoDe(request));
}

export function indicadores(
  request: FastifyRequest,
): Promise<RespostaIndicadoresCenso> {
  return service.indicadores(contextoDe(request));
}

export async function panorama(
  request: FastifyRequest<{
    Querystring: { rodada?: string; bloco?: string; segmento?: string };
  }>,
  reply: FastifyReply,
) {
  const { bytes, nome } = await service.panorama(
    contextoDe(request),
    request.query,
  );
  return reply
    .header("content-type", "application/pdf")
    .header("content-disposition", disposicao("attachment", nome))
    .header("cache-control", "private, no-store")
    .send(Buffer.from(bytes));
}

export function feedbacks(
  request: FastifyRequest<{
    Querystring: { rodada: string; origem?: string };
  }>,
): Promise<RespostaFeedbacksCenso> {
  return service.feedbacks(contextoDe(request), request.query);
}

export function rodadas(request: FastifyRequest) {
  return service.contagemDasRodadas(contextoDe(request));
}

export function rodada(
  request: FastifyRequest<ComId>,
): Promise<RespostaRodadaCenso> {
  return service.rodada(contextoDe(request), request.params.id);
}

export function demonstracao(request: FastifyRequest) {
  return service.demonstracao(contextoDe(request));
}

export function presencial(
  request: FastifyRequest<{ Params: { convite: string } }>,
): Promise<ConviteCenso> {
  return service.presencial(contextoDe(request), request.params.convite);
}

export function abrirRodada(request: FastifyRequest<ComForm>) {
  return mensagem(service.abrirRodada(contextoDe(request), request.body));
}

export function gerarConvites(request: FastifyRequest<ComId>) {
  return mensagem(
    service.gerarConvites(contextoDe(request), request.params.id),
  );
}

export function encerrarRodada(request: FastifyRequest<ComId>) {
  return mensagem(
    service.encerrarRodada(contextoDe(request), request.params.id),
  );
}

export function editarRodada(
  request: FastifyRequest<ComId & { Body: ComForm["Body"] }>,
) {
  return mensagem(
    service.editarRodada(contextoDe(request), request.params.id, request.body),
  );
}

export function excluirRodada(request: FastifyRequest<ComId>) {
  return mensagem(
    service.excluirRodada(contextoDe(request), request.params.id),
  );
}

export function conviteEnviado(request: FastifyRequest<ComId>) {
  return mensagem(
    service.marcarConviteEnviado(contextoDe(request), request.params.id),
  );
}

export function responder(request: FastifyRequest<ComForm>) {
  return mensagem(service.responderNaTela(contextoDe(request), request.body));
}

export function moverSugestao(request: FastifyRequest<ComForm>) {
  return mensagem(service.moverSugestao(contextoDe(request), request.body));
}

export function salvarTema(request: FastifyRequest<ComForm>) {
  return mensagem(service.salvarTema(contextoDe(request), request.body));
}

// Pelo link (sem login)

export function publico(
  request: FastifyRequest<{ Params: { token: string } }>,
  reply: FastifyReply,
): Promise<RespostaCensoPublico> {
  reply.header("cache-control", "private, no-store");
  return service.publico(request.params.token);
}

export function responderPublico(
  request: FastifyRequest<{ Params: { token: string }; Body: Formulario }>,
) {
  return mensagem(
    service.responderPeloLink(request.params.token, request.body),
  );
}
