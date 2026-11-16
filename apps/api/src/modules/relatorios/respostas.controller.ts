import type { RespostaMensagem } from "@arp/shared/contratos/auth";
import type { Resposta } from "@arp/shared/formularios/contratos";
import type { FastifyReply, FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import * as service from "./respostas.service";

// HTTP das respostas de um relatório.

type DoFormulario = { Params: { id: string } };
type DaResposta = { Params: { id: string; resposta: string } };

export async function listar(
  request: FastifyRequest<DoFormulario>,
): Promise<{ respostas: Resposta[] }> {
  return {
    respostas: await service.doFormulario(
      contextoDe(request),
      request.params.id,
    ),
  };
}

export function obter(request: FastifyRequest<DaResposta>): Promise<Resposta> {
  const { id, resposta } = request.params;
  return service.obter(contextoDe(request), id, resposta);
}

export async function excluir(
  request: FastifyRequest<DaResposta>,
): Promise<RespostaMensagem> {
  const { id, resposta } = request.params;
  await service.excluir(contextoDe(request), id, resposta);
  return { mensagem: "Resposta excluída." };
}

/** Manda para o link assinado de 5 minutos do arquivo. */
export async function baixarArquivo(
  request: FastifyRequest<
    DoFormulario & { Querystring: { caminho: string; nome: string } }
  >,
  reply: FastifyReply,
) {
  const { caminho, nome } = request.query;
  const link = await service.linkDoArquivo(
    contextoDe(request),
    request.params.id,
    caminho,
    nome,
  );
  return reply.redirect(link);
}
