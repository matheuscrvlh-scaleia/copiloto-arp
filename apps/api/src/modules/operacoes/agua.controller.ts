import type {
  EntradaVinculo,
  RespostaExtratoDaAgua,
  RespostaHidrometroDaAgua,
  RespostaMesDaAgua,
} from "@arp/shared/operacoes/contratos/agua";
import type { RespostaMensagem } from "@arp/shared/operacoes/contratos/base";
import type { FastifyReply, FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import { disposicao } from "@/infra/arquivos/http";
import * as service from "./agua.service";

// HTTP das telas da água. Sem regra e sem SQL.

type Busca = Record<string, string | string[] | undefined>;

export async function meses(request: FastifyRequest) {
  return { meses: await service.mesesImportados(contextoDe(request)) };
}

export function mes(
  request: FastifyRequest<{ Params: { referencia: string } }>,
): Promise<RespostaMesDaAgua> {
  return service.mesDaAgua(contextoDe(request), request.params.referencia);
}

export function extrato(
  request: FastifyRequest<{ Querystring: Busca }>,
): Promise<RespostaExtratoDaAgua> {
  return service.extrato(contextoDe(request), request.query);
}

export function hidrometro(
  request: FastifyRequest<{ Params: { hidrometro: string } }>,
): Promise<RespostaHidrometroDaAgua> {
  return service.hidrometro(contextoDe(request), request.params.hidrometro);
}

export async function extratoEmPdf(
  request: FastifyRequest<{ Querystring: Busca }>,
  reply: FastifyReply,
) {
  const { pdf, nome } = await service.extratoEmPdf(
    contextoDe(request),
    request.query,
  );
  return reply
    .header("content-type", "application/pdf")
    .header("content-disposition", disposicao("inline", nome))
    .header("cache-control", "private, no-store")
    .send(Buffer.from(pdf));
}

export async function corrigirVinculo(
  request: FastifyRequest<{ Body: EntradaVinculo }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.corrigirVinculo(contextoDe(request), request.body),
  };
}

export async function removerVinculo(
  request: FastifyRequest<{ Params: { id: string } }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.removerVinculo(
      contextoDe(request),
      request.params.id,
    ),
  };
}
