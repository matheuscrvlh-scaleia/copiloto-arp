import type { OpcoesPublico } from "@arp/shared/calendario/contratos";
import type { FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import * as service from "./publico.service";

export function opcoes(request: FastifyRequest): Promise<OpcoesPublico> {
  return service.opcoes(contextoDe(request));
}
