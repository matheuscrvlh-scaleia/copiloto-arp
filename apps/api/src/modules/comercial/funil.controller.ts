import type { RespostaFunil } from "@arp/shared/comercial/contratos/funil";
import type { FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import * as service from "./funil.service";

export function funil(request: FastifyRequest): Promise<RespostaFunil> {
  return service.dadosDoFunil(contextoDe(request));
}
