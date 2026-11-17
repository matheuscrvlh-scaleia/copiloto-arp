import type {
  EntradaEntrar,
  EntradaTrocarSenha,
  RespostaEu,
  RespostaMensagem,
  RespostaSessao,
} from "@arp/shared/contratos/auth";
import type { FastifyReply, FastifyRequest } from "fastify";
import { contextoDe, origemDe } from "@/http/permissao";
import { cookiesDaSessao, gravarCookies, limparCookies } from "@/http/sessao";
import * as service from "./auth.service";

// HTTP do acesso: lê a requisição já validada, chama o service e cuida dos
// cookies. Sem regra e sem SQL.

export async function entrar(
  request: FastifyRequest<{ Body: EntradaEntrar }>,
  reply: FastifyReply,
): Promise<RespostaEu> {
  const { credenciais, resposta } = await service.entrar(
    request.body,
    origemDe(request),
  );
  gravarCookies(reply, credenciais);
  return resposta;
}

export async function eu(request: FastifyRequest): Promise<RespostaEu> {
  return service.eu(contextoDe(request));
}

export async function renovar(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<RespostaSessao> {
  try {
    const { credenciais, sessao } = await service.renovar(
      cookiesDaSessao(request).renovacao,
      origemDe(request),
    );
    gravarCookies(reply, credenciais);
    return { sessao };
  } catch (erro) {
    // A sessão acabou: não deixa cookie morto no navegador. Só nesse caso:
    // sem token (ou com a pessoa já em outra sessão) a resposta não toca em
    // cookie, para não apagar os de um `entrar` que respondeu antes desta.
    if (erro instanceof service.ErroDeSessaoEncerrada) limparCookies(reply);
    throw erro;
  }
}

export async function uso(request: FastifyRequest): Promise<RespostaSessao> {
  return { sessao: await service.registrarUso(contextoDe(request)) };
}

export async function trocarSenha(
  request: FastifyRequest<{ Body: EntradaTrocarSenha }>,
): Promise<RespostaMensagem> {
  await service.trocarSenha(contextoDe(request), request.body.senha);
  return { mensagem: "Senha definida." };
}

export async function sair(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<RespostaMensagem> {
  await service.sair(cookiesDaSessao(request));
  limparCookies(reply);
  return { mensagem: "Você saiu do sistema." };
}
