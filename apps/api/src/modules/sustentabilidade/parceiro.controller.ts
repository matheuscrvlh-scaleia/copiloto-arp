import type { RespostaMensagem } from "@arp/shared/contratos/auth";
import type {
  CorrecaoDoParceiro,
  EntradaDoParceiro,
  RespostaParceiro,
} from "@arp/shared/sustentabilidade/contratos/parceiro";
import type { FastifyReply, FastifyRequest } from "fastify";
import * as service from "./parceiro.service";

// HTTP da página do parceiro (sem sessão: vale pelo token).

type ComToken = { Params: { token: string } };

export async function pagina(
  request: FastifyRequest<ComToken>,
): Promise<RespostaParceiro> {
  return service.paginaDoParceiro(request.params.token);
}

export async function lancar(
  request: FastifyRequest<ComToken & { Body: EntradaDoParceiro }>,
  reply: FastifyReply,
): Promise<RespostaMensagem> {
  const mensagem = await service.lancarPeloLink(
    request.params.token,
    request.body,
  );
  reply.code(201);
  return { mensagem };
}

export async function corrigir(
  request: FastifyRequest<{
    Params: { token: string; id: string };
    Body: CorrecaoDoParceiro;
  }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.corrigirPeloLink(
      request.params.token,
      request.params.id,
      request.body,
    ),
  };
}
