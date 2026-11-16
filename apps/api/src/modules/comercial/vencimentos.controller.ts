import type {
  RespostaVencimento,
  RespostaVencimentos,
} from "@arp/shared/comercial/contratos/vencimentos";
import type { FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import * as service from "./vencimentos.service";

export function vencimentos(
  request: FastifyRequest,
): Promise<RespostaVencimentos> {
  return service.dadosDosVencimentos(contextoDe(request));
}

export function vencimento(
  request: FastifyRequest<{ Params: { contrato: string } }>,
): Promise<RespostaVencimento> {
  return service.dadosDoVencimento(
    contextoDe(request),
    request.params.contrato,
  );
}
