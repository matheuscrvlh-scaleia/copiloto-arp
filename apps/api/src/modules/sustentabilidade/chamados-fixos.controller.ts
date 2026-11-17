import type { esquemaChamadoFixo } from "@arp/shared/sustentabilidade/painel-parametros";
import type { FastifyRequest } from "fastify";
import type { z } from "zod";
import { contextoDe } from "@/http/permissao";
import * as service from "./chamados-fixos.service";

// HTTP dos chamados fixos. Sem regra e sem SQL.

type Tipo = z.output<typeof esquemaChamadoFixo>["tipo"];

export async function estados(request: FastifyRequest) {
  return { estados: (await service.chamadosFixos(contextoDe(request))) ?? [] };
}

export async function candidatos(
  request: FastifyRequest<{ Params: { tipo: Tipo } }>,
) {
  return {
    candidatos: await service.candidatosAResponsavel(
      contextoDe(request),
      request.params.tipo,
    ),
  };
}

export async function criar(
  request: FastifyRequest<{ Body: z.output<typeof esquemaChamadoFixo> }>,
) {
  const b = request.body;
  return {
    mensagem: await service.criarChamadoFixo(contextoDe(request), {
      tipo: b.tipo,
      responsavelId: b.responsavel,
      diaSemana: b.dia_semana,
      diaMes: b.dia_mes,
    }),
  };
}
