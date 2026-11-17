import type {
  EntradaCargo,
  EntradaNovoUsuario,
  EntradaSenha,
  EntradaSituacao,
  EntradaUsuario,
  ParametrosDoId,
  RespostaCargos,
  RespostaCriado,
  RespostaPermissoesDePrograma,
  RespostaUsuario,
  RespostaUsuarios,
} from "@arp/shared/admin/contratos";
import type { RespostaMensagem } from "@arp/shared/contratos/auth";
import type { FastifyReply, FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import * as service from "./usuarios.service";

type ComId = { Params: ParametrosDoId };

export async function listar(
  request: FastifyRequest,
): Promise<RespostaUsuarios> {
  return { usuarios: await service.usuarios(contextoDe(request)) };
}

export async function ler(
  request: FastifyRequest<ComId>,
): Promise<RespostaUsuario> {
  return {
    usuario: await service.usuario(contextoDe(request), request.params.id),
  };
}

export async function criar(
  request: FastifyRequest<{ Body: EntradaNovoUsuario }>,
  reply: FastifyReply,
): Promise<RespostaCriado> {
  const id = await service.criarUsuario(contextoDe(request), request.body);
  reply.code(201);
  return { id, mensagem: "Usuário criado." };
}

export async function salvar(
  request: FastifyRequest<ComId & { Body: EntradaUsuario }>,
): Promise<RespostaMensagem> {
  await service.salvarUsuario(
    contextoDe(request),
    request.params.id,
    request.body,
  );
  return { mensagem: "Salvo." };
}

export async function alternar(
  request: FastifyRequest<ComId & { Body: EntradaSituacao }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.alternarUsuario(
      contextoDe(request),
      request.params.id,
      request.body.ativo,
    ),
  };
}

export async function excluir(
  request: FastifyRequest<ComId>,
): Promise<RespostaMensagem> {
  await service.excluirUsuario(contextoDe(request), request.params.id);
  return { mensagem: "Usuário excluído." };
}

export async function removerIndividuais(
  request: FastifyRequest<ComId>,
): Promise<RespostaMensagem> {
  await service.removerIndividuais(contextoDe(request), request.params.id);
  return { mensagem: "Removidas. O acesso agora vem só do cargo." };
}

export async function trocarSenha(
  request: FastifyRequest<ComId & { Body: EntradaSenha }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.trocarSenha(
      contextoDe(request),
      request.params.id,
      request.body,
    ),
  };
}

export async function listarCargos(
  request: FastifyRequest,
): Promise<RespostaCargos> {
  return { cargos: await service.cargos(contextoDe(request)) };
}

export async function listarPermissoesDePrograma(
  request: FastifyRequest,
): Promise<RespostaPermissoesDePrograma> {
  return {
    programas: await service.permissoesDePrograma(contextoDe(request)),
  };
}

export async function criarCargo(
  request: FastifyRequest<{ Body: EntradaCargo }>,
  reply: FastifyReply,
): Promise<RespostaCriado> {
  const id = await service.salvarCargo(contextoDe(request), null, request.body);
  reply.code(201);
  return { id, mensagem: "Cargo criado." };
}

export async function salvarCargo(
  request: FastifyRequest<ComId & { Body: EntradaCargo }>,
): Promise<RespostaMensagem> {
  await service.salvarCargo(
    contextoDe(request),
    request.params.id,
    request.body,
  );
  return { mensagem: "Salvo. Vale para todos os usuários deste cargo." };
}

export async function alternarCargo(
  request: FastifyRequest<ComId & { Body: EntradaSituacao }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.alternarCargo(
      contextoDe(request),
      request.params.id,
      request.body.ativo,
    ),
  };
}

export async function apagarCargo(
  request: FastifyRequest<ComId>,
): Promise<RespostaMensagem> {
  await service.apagarCargo(contextoDe(request), request.params.id);
  return { mensagem: "Cargo excluído." };
}
