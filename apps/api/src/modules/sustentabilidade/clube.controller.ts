import {
  type acaoDoClube,
  type contatoDoParticipante,
  type contribuicaoDoClube,
  type dadosDoParticipante,
  type NovoParticipante,
  primeiroErro,
  type saidaDoClube,
  termoDoClube,
  type valorCombinado,
} from "@arp/shared/sustentabilidade/clube-cadastro";
import type {
  consultaClube,
  consultaContribuicoes,
} from "@arp/shared/sustentabilidade/contratos/clube";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { z } from "zod";
import { ErroDeNegocio, ErroDeValidacao } from "@/erros";
import { lerFormulario } from "@/http/formulario";
import { contextoDe } from "@/http/permissao";
import * as service from "./clube.service";
import * as acoes from "./clube-acoes.service";

// HTTP do Clube SustentArp. Sem regra e sem SQL.

type ComId = { Params: { id: string } };
type Corpo<T extends z.ZodType> = { Body: z.output<T> };
const ok = (mensagem: string) => ({ mensagem });

export function lista(
  request: FastifyRequest<{ Querystring: z.output<typeof consultaClube> }>,
) {
  return service.dadosDoClube(contextoDe(request), request.query.ano);
}

export function participante(request: FastifyRequest<ComId>) {
  return service.detalheDoParticipante(contextoDe(request), request.params.id);
}

export function contribuicoes(
  request: FastifyRequest<{
    Querystring: z.output<typeof consultaContribuicoes>;
  }>,
) {
  return service.contribuicoesDoClube(contextoDe(request), request.query);
}

export async function linkDoTermo(
  request: FastifyRequest<
    ComId & { Querystring: { qual: "arquivo" | "assinatura" } }
  >,
) {
  return {
    url: await acoes.linkDoTermo(
      contextoDe(request),
      request.params.id,
      request.query.qual,
    ),
  };
}

export async function criarParticipante(
  request: FastifyRequest<{ Body: NovoParticipante }>,
  reply: FastifyReply,
) {
  const id = await acoes.criarParticipante(contextoDe(request), request.body);
  return reply.code(201).send({ id });
}

export async function salvarDados(
  request: FastifyRequest<Corpo<typeof dadosDoParticipante>>,
) {
  return ok(
    await acoes.salvarDadosDoParticipante(contextoDe(request), request.body),
  );
}

export async function salvarContato(
  request: FastifyRequest<Corpo<typeof contatoDoParticipante>>,
) {
  return ok(await acoes.salvarContato(contextoDe(request), request.body));
}

export async function salvarValor(
  request: FastifyRequest<Corpo<typeof valorCombinado>>,
) {
  return ok(
    await acoes.salvarValorCombinado(contextoDe(request), request.body),
  );
}

export async function registrarSaida(
  request: FastifyRequest<Corpo<typeof saidaDoClube>>,
) {
  return ok(await acoes.registrarSaida(contextoDe(request), request.body));
}

export async function reativar(
  request: FastifyRequest<{ Body: { participante_id: string } }>,
) {
  return ok(
    await acoes.reativarParticipante(
      contextoDe(request),
      request.body.participante_id,
    ),
  );
}

/** Formulário do termo: os campos validados e o arquivo do campo dado. */
async function formularioDoTermo(
  request: FastifyRequest,
  campo: "arquivo" | "assinatura",
  limite: number,
  grandeDemais: string,
) {
  let form: Awaited<ReturnType<typeof lerFormulario>>;
  try {
    // Um byte a mais que o limite: o arquivo no limite ainda passa.
    form = await lerFormulario(request, {
      arquivos: 1,
      bytesPorArquivo: limite + 1,
    });
  } catch (e) {
    if (e instanceof Error && "statusCode" in e && e.statusCode === 413)
      throw new ErroDeNegocio(grandeDemais);
    throw e;
  }
  const d = termoDoClube.safeParse(form.campos);
  if (!d.success) throw new ErroDeValidacao(primeiroErro(d.error));
  const a = form.arquivos.find((x) => x.campo === campo);
  return {
    dados: d.data,
    arquivo: a
      ? { nome: a.nome, tipo: a.tipo, bytes: new Uint8Array(a.bytes) }
      : undefined,
  };
}

export async function termoAnexo(request: FastifyRequest) {
  const { dados, arquivo } = await formularioDoTermo(
    request,
    "arquivo",
    acoes.TERMO_MAX_MB * 1024 * 1024,
    `O PDF passa de ${acoes.TERMO_MAX_MB} MB. Envie um arquivo menor.`,
  );
  return ok(
    await acoes.registrarTermoAnexo(contextoDe(request), dados, arquivo),
  );
}

export async function termoAssinado(request: FastifyRequest) {
  const { dados, arquivo } = await formularioDoTermo(
    request,
    "assinatura",
    acoes.ASSINATURA_MAX_BYTES,
    "Assinatura grande demais.",
  );
  return ok(
    await acoes.registrarTermoAssinado(contextoDe(request), dados, arquivo),
  );
}

export async function removerTermo(request: FastifyRequest<ComId>) {
  return ok(await acoes.removerTermo(contextoDe(request), request.params.id));
}

export async function registrarContribuicao(
  request: FastifyRequest<Corpo<typeof contribuicaoDoClube>>,
) {
  return ok(
    await acoes.registrarContribuicao(contextoDe(request), request.body),
  );
}

export async function removerContribuicao(request: FastifyRequest<ComId>) {
  return ok(
    await acoes.removerContribuicao(contextoDe(request), request.params.id),
  );
}

export async function registrarAcao(
  request: FastifyRequest<Corpo<typeof acaoDoClube>>,
) {
  return ok(await acoes.registrarAcao(contextoDe(request), request.body));
}

export async function removerAcao(request: FastifyRequest<ComId>) {
  return ok(await acoes.removerAcao(contextoDe(request), request.params.id));
}
