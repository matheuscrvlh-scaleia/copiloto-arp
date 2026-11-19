import type { RespostaMensagem } from "@arp/shared/contratos/auth";
import type {
  Formulario,
  FormularioDaLista,
} from "@arp/shared/formularios/contratos";
import type {
  aparenciaSchema,
  configuracoesSchema,
  conteudoSchema,
} from "@arp/shared/formularios/formulario";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { z } from "zod";
import { contextoDe } from "@/http/permissao";
import * as service from "./relatorios.service";

// HTTP dos formulários (a equipe): lê a requisição validada e chama o service.

type ComId = { Params: { id: string } };

export async function listar(
  request: FastifyRequest,
): Promise<{ formularios: FormularioDaLista[] }> {
  return { formularios: await service.listar(contextoDe(request)) };
}

export function obter(request: FastifyRequest<ComId>): Promise<Formulario> {
  return service.obter(contextoDe(request), request.params.id);
}

export async function criar(
  request: FastifyRequest<{ Body: { modelo?: string } }>,
  reply: FastifyReply,
): Promise<{ id: string }> {
  const id = await service.criar(contextoDe(request), request.body.modelo);
  reply.code(201);
  return { id };
}

export async function salvarConteudo(
  request: FastifyRequest<ComId & { Body: z.output<typeof conteudoSchema> }>,
): Promise<RespostaMensagem> {
  await service.salvarConteudo(
    contextoDe(request),
    request.params.id,
    request.body,
  );
  return { mensagem: "Formulário salvo." };
}

export async function salvarConfiguracoes(
  request: FastifyRequest<
    ComId & { Body: z.output<typeof configuracoesSchema> }
  >,
): Promise<RespostaMensagem> {
  await service.salvarConfiguracoes(
    contextoDe(request),
    request.params.id,
    request.body,
  );
  return { mensagem: "Configurações salvas." };
}

export async function salvarAparencia(
  request: FastifyRequest<ComId & { Body: z.output<typeof aparenciaSchema> }>,
): Promise<RespostaMensagem> {
  await service.salvarAparencia(
    contextoDe(request),
    request.params.id,
    request.body,
  );
  return { mensagem: "Aparência salva." };
}

export async function mudarSituacao(
  request: FastifyRequest<ComId & { Body: { acao: service.AcaoDeSituacao } }>,
): Promise<RespostaMensagem> {
  const mensagem = await service.mudarSituacao(
    contextoDe(request),
    request.params.id,
    request.body.acao,
  );
  return { mensagem };
}

export async function gerarNovoLink(
  request: FastifyRequest<ComId>,
): Promise<RespostaMensagem> {
  await service.gerarNovoLink(contextoDe(request), request.params.id);
  return { mensagem: "Link novo gerado. O anterior não abre mais." };
}

export async function duplicar(
  request: FastifyRequest<ComId>,
  reply: FastifyReply,
): Promise<{ id: string }> {
  const id = await service.duplicar(contextoDe(request), request.params.id);
  reply.code(201);
  return { id };
}

export async function excluir(
  request: FastifyRequest<ComId>,
): Promise<RespostaMensagem> {
  await service.excluir(contextoDe(request), request.params.id);
  return { mensagem: "Formulário excluído." };
}
