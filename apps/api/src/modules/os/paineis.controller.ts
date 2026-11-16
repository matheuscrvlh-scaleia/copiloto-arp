import type {
  ConsultaDoPainel,
  RespostaPainel,
} from "@arp/shared/os/contratos/paineis";
import type { FastifyReply, FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import { disposicao } from "@/infra/arquivos/http";
import * as service from "./paineis.service";

// HTTP dos painéis: lê a requisição validada e chama o service.

type ComConsulta = { Querystring: ConsultaDoPainel };

export function painel(
  request: FastifyRequest<ComConsulta>,
): Promise<RespostaPainel> {
  return service.lerPainel(contextoDe(request), request.query);
}

export async function exportar(
  request: FastifyRequest<ComConsulta>,
  reply: FastifyReply,
) {
  const r = await service.exportarPainel(contextoDe(request), request.query);
  return reply
    .header("content-type", "application/pdf")
    .header("content-disposition", disposicao("attachment", r.nome))
    .header("cache-control", "private, no-store")
    .send(Buffer.from(r.bytes));
}
