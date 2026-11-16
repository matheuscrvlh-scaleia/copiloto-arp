import type { TipoAnexo } from "@arp/shared/comercial/contrato";
import type { RespostaMensagem } from "@arp/shared/comercial/contratos/base";
import type {
  EntradaSalvarContrato,
  EntradaSalvarDistrato,
  RespostaApoioContrato,
  RespostaContrato,
  RespostaContratosEnet,
  RespostaFichaCarregada,
  RespostaGravacao,
  RespostaListaContratos,
  RespostaVistoriaPuxada,
  VistoriaDoLuc,
} from "@arp/shared/comercial/contratos/contratos";
import type { FastifyReply, FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import * as service from "./contratos.service";

type ComId = { Params: { id: string } };
type ComAnexo = { Params: { anexo: string } };

export function lista(
  request: FastifyRequest<{
    Querystring: { atualizacao?: "30" | "90" | "365" | "todos" };
  }>,
): Promise<RespostaListaContratos> {
  return service.lista(contextoDe(request), request.query.atualizacao ?? "90");
}

export function apoio(request: FastifyRequest): Promise<RespostaApoioContrato> {
  return service.apoio(contextoDe(request));
}

export function contratosEnet(
  request: FastifyRequest,
): Promise<RespostaContratosEnet> {
  return service.contratosParaDistrato(contextoDe(request));
}

export async function vistoria(
  request: FastifyRequest<{
    Querystring: { luc: string; tipo: "entrada" | "saida" };
  }>,
): Promise<{ vistoria: VistoriaDoLuc | null }> {
  return {
    vistoria: await service.vistoria(
      contextoDe(request),
      request.query.luc,
      request.query.tipo,
    ),
  };
}

export function contrato(
  request: FastifyRequest<ComId>,
): Promise<RespostaContrato> {
  return service.contrato(contextoDe(request), request.params.id);
}

export function salvarContrato(
  request: FastifyRequest<{ Body: EntradaSalvarContrato }>,
): Promise<RespostaGravacao> {
  return service.salvarContrato(contextoDe(request), request.body);
}

export function marcarPronto(
  request: FastifyRequest<ComId & { Body: { lido: string } }>,
): Promise<RespostaGravacao> {
  return service.marcarPronto(
    contextoDe(request),
    request.params.id,
    request.body.lido,
  );
}

export function salvarDistrato(
  request: FastifyRequest<{ Body: EntradaSalvarDistrato }>,
): Promise<RespostaGravacao> {
  return service.salvarDistrato(contextoDe(request), request.body);
}

export function carregarFicha(
  request: FastifyRequest<ComId>,
): Promise<RespostaFichaCarregada> {
  return service.carregarFicha(contextoDe(request), request.params.id);
}

export function puxarVistoria(
  request: FastifyRequest<{ Body: { lucs: string[] } }>,
): Promise<RespostaVistoriaPuxada> {
  return service.puxarVistoria(contextoDe(request), request.body.lucs);
}

export function prepararAnexo(
  request: FastifyRequest<
    ComId & { Body: { tipo: TipoAnexo; nome: string; tamanho: number } }
  >,
): Promise<{ url: string; path: string }> {
  return service.prepararAnexo(
    contextoDe(request),
    request.params.id,
    request.body,
  );
}

export async function registrarAnexo(
  request: FastifyRequest<
    ComId & { Body: { tipo: TipoAnexo; path: string; nome: string } }
  >,
  reply: FastifyReply,
): Promise<RespostaMensagem> {
  const mensagem = await service.registrarAnexo(
    contextoDe(request),
    request.params.id,
    request.body,
  );
  reply.code(201);
  return { mensagem };
}

export async function removerAnexo(
  request: FastifyRequest<ComAnexo>,
): Promise<RespostaMensagem> {
  await service.removerAnexo(contextoDe(request), request.params.anexo);
  return { mensagem: "Anexo removido." };
}

export async function linkDoAnexo(
  request: FastifyRequest<ComAnexo>,
): Promise<{ url: string }> {
  return {
    url: await service.linkDoAnexo(contextoDe(request), request.params.anexo),
  };
}
