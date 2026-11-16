import type {
  RespostaLuc,
  RespostaOcupacao,
} from "@arp/shared/comercial/contratos/ocupacao";
import type { FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import * as service from "./ocupacao.service";

export function ocupacao(request: FastifyRequest): Promise<RespostaOcupacao> {
  return service.dadosDaOcupacao(contextoDe(request));
}

export function luc(
  request: FastifyRequest<{ Params: { numero: string } }>,
): RespostaLuc {
  return service.dadosDoLuc(contextoDe(request), request.params.numero);
}
