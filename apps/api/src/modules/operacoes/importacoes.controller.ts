import {
  type ContaAgua,
  LIMITE_CONTA_BYTES,
} from "@arp/shared/operacoes/agua-conta";
import type { LeituraEditada } from "@arp/shared/operacoes/agua-edicao";
import { entradaFotoDoHidrometro } from "@arp/shared/operacoes/contratos/importacoes";
import type { FastifyRequest } from "fastify";
import type { z } from "zod";
import { ErroDeNegocio, ErroDeValidacao } from "@/erros";
import { lerFormulario } from "@/http/formulario";
import { contextoDe } from "@/http/permissao";
import * as conta from "./agua-conta.service";
import * as leituras from "./agua-leituras.service";
import * as service from "./importacoes.service";

// HTTP do histórico de importações, da conta da concessionária de água e
// das correções da água. Sem regra e sem SQL.

type ComId = { Params: { id: string } };
type Busca = Record<string, string | string[] | undefined>;

/** Formulário com um arquivo; arquivo maior que o limite vira a mensagem dada. */
async function formulario(
  request: FastifyRequest,
  bytesPorArquivo: number,
  grandeDemais: string,
) {
  try {
    return await lerFormulario(request, { arquivos: 1, bytesPorArquivo });
  } catch (e) {
    if (e instanceof Error && "statusCode" in e && e.statusCode === 413)
      throw new ErroDeNegocio(grandeDemais);
    throw e;
  }
}

function validar<T>(esquema: z.ZodType<T>, campos: unknown): T {
  const r = esquema.safeParse(campos);
  if (r.success) return r.data;
  throw new ErroDeValidacao(r.error.issues[0]?.message ?? "Dados inválidos.");
}

// --- Histórico --------------------------------------------------------------

export function pagina(request: FastifyRequest<{ Querystring: Busca }>) {
  return service.paginaDeImportacoes(contextoDe(request), request.query);
}

export async function situacao(request: FastifyRequest) {
  return { situacao: await service.situacaoPorTipo(contextoDe(request)) };
}

export function importacao(request: FastifyRequest<ComId>) {
  return service.importacao(contextoDe(request), request.params.id);
}

export async function desfazer(request: FastifyRequest<ComId>) {
  return {
    mensagem: await service.desfazer(contextoDe(request), request.params.id),
  };
}

// --- Conta da concessionária de água ----------------------------------------

export async function lerConta(request: FastifyRequest) {
  const form = await formulario(
    request,
    LIMITE_CONTA_BYTES,
    "O arquivo passa de 10 MB.",
  );
  const arquivo = form.arquivos.find((a) => a.campo === "arquivo");
  return {
    previa: await conta.ler(
      contextoDe(request),
      arquivo ? { nome: arquivo.nome, bytes: arquivo.bytes } : null,
    ),
  };
}

export async function previaAbertaDaConta(request: FastifyRequest) {
  return { previa: await conta.previaAberta(contextoDe(request)) };
}

export function confirmarConta(
  request: FastifyRequest<ComId & { Body: ContaAgua }>,
) {
  return conta.confirmar(contextoDe(request), request.params.id, request.body);
}

export async function descartarConta(request: FastifyRequest<ComId>) {
  return {
    mensagem: await conta.descartar(contextoDe(request), request.params.id),
  };
}

export async function corrigirConta(
  request: FastifyRequest<ComId & { Body: ContaAgua }>,
) {
  return {
    mensagem: await conta.corrigir(
      contextoDe(request),
      request.params.id,
      request.body,
    ),
  };
}

// --- Correções da água ------------------------------------------------------

export async function salvarLeitura(
  request: FastifyRequest<ComId & { Body: LeituraEditada }>,
) {
  return {
    mensagem: await leituras.salvarLeitura(contextoDe(request), {
      ...request.body,
      id: request.params.id,
    }),
  };
}

export async function excluirLeitura(request: FastifyRequest<ComId>) {
  return {
    mensagem: await leituras.excluirLeitura(
      contextoDe(request),
      request.params.id,
    ),
  };
}

export async function trocarFoto(request: FastifyRequest<ComId>) {
  const form = await formulario(
    request,
    leituras.FOTO_MAX,
    "A foto passa de 10 MB.",
  );
  return {
    mensagem: await leituras.trocarFoto(
      contextoDe(request),
      request.params.id,
      form.arquivos.find((a) => a.campo === "foto")?.bytes ?? null,
    ),
  };
}

export async function tirarFoto(request: FastifyRequest<ComId>) {
  return {
    mensagem: await leituras.tirarFoto(contextoDe(request), request.params.id),
  };
}

export async function fotoDoHidrometro(request: FastifyRequest) {
  const form = await formulario(
    request,
    leituras.FOTO_MAX,
    "A foto passa de 10 MB.",
  );
  const pedido = validar(entradaFotoDoHidrometro, form.campos);
  return {
    mensagem: await leituras.fotoDoHidrometro(
      contextoDe(request),
      pedido,
      form.arquivos.find((a) => a.campo === "foto")?.bytes ?? null,
    ),
  };
}
