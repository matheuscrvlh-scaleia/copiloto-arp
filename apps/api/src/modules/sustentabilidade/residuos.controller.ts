import type { RespostaMensagem } from "@arp/shared/contratos/auth";
import type {
  RespostaNotaRcc,
  RespostaRcc,
  RespostaRondas,
} from "@arp/shared/sustentabilidade/contratos/residuos";
import type { esquemaNotaRcc } from "@arp/shared/sustentabilidade/rcc-lancamento";
import type { EntradaDaRonda } from "@arp/shared/sustentabilidade/rondas-lancamento";
import type { FastifyRequest } from "fastify";
import type { z } from "zod";
import { contextoDe } from "@/http/permissao";
import * as service from "./residuos.service";

// HTTP das rondas e do RCC.

type Envio = { Body: { nome: string; tamanho: number } };

export async function rondas(
  request: FastifyRequest<{ Querystring: { de: string; ate: string } }>,
): Promise<RespostaRondas> {
  return service.dadosDasRondas(
    contextoDe(request),
    request.query.de,
    request.query.ate,
  );
}

export async function paraLancar(request: FastifyRequest) {
  return service.paraLancarRonda(contextoDe(request));
}

export async function prepararFoto(request: FastifyRequest<Envio>) {
  return service.prepararFotoDaRonda(contextoDe(request), request.body);
}

export async function lancarRonda(
  request: FastifyRequest<{ Body: EntradaDaRonda }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.lancarRonda(contextoDe(request), request.body),
  };
}

export async function rcc(request: FastifyRequest): Promise<RespostaRcc> {
  return service.dadosDoRcc(contextoDe(request));
}

export async function prepararPdf(request: FastifyRequest<Envio>) {
  return service.prepararPdfDaNota(contextoDe(request), request.body);
}

export async function lancarNota(
  request: FastifyRequest<{ Body: z.output<typeof esquemaNotaRcc> }>,
): Promise<RespostaNotaRcc> {
  return service.lancarNotaRcc(contextoDe(request), request.body);
}
