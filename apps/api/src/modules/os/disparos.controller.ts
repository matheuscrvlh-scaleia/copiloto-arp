import type { RespostaMensagem } from "@arp/shared/os/contratos/base";
import type {
  EntradaDisparo,
  EntradaPararSerie,
  RespostaDisparos,
} from "@arp/shared/os/contratos/disparos";
import type { FastifyReply, FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import * as service from "./modelos.service";

// HTTP de Disparos e lembretes: lê a requisição validada e chama o service.

export function ler(request: FastifyRequest): Promise<RespostaDisparos> {
  return service.lerDisparos(contextoDe(request));
}

export async function disparar(
  request: FastifyRequest<{ Body: EntradaDisparo }>,
  reply: FastifyReply,
): Promise<RespostaMensagem> {
  const mensagem = await service.dispararModeloManual(
    contextoDe(request),
    request.body,
  );
  reply.code(201);
  return { mensagem };
}

export async function pararSerie(
  request: FastifyRequest<{ Params: { id: string }; Body: EntradaPararSerie }>,
): Promise<RespostaMensagem> {
  await service.pararSerie(
    contextoDe(request),
    request.params.id,
    request.body.ultima_id,
  );
  return { mensagem: "Série parada. As ocorrências já criadas continuam." };
}
