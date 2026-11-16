import type {
  EntradaEmpresa,
  RespostaEmpresa,
} from "@arp/shared/admin/contratos";
import type { RespostaMensagem } from "@arp/shared/contratos/auth";
import type { FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import * as service from "./empresa.service";

export async function ler(request: FastifyRequest): Promise<RespostaEmpresa> {
  return { empresa: await service.empresa(contextoDe(request)) };
}

export async function salvar(
  request: FastifyRequest<{ Body: EntradaEmpresa }>,
): Promise<RespostaMensagem> {
  await service.salvarEmpresa(contextoDe(request), request.body);
  return { mensagem: "Salvo." };
}
