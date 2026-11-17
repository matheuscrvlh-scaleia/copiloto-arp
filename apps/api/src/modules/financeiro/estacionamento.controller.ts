import type { ConsultaDoEstacionamento } from "@arp/shared/financeiro/estacionamento";
import type { FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import * as service from "./estacionamento.service";

export const estacionamento = (
  request: FastifyRequest<{ Querystring: ConsultaDoEstacionamento }>,
) => service.estacionamento(contextoDe(request), request.query);
