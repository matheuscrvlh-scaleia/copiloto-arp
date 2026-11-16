import type { Papel } from "@arp/shared/operacoes/energisa-contas";
import type { FastifyRequest } from "fastify";
import { ErroDeNegocio } from "@/erros";
import { lerFormulario } from "@/http/formulario";
import { contextoDe } from "@/http/permissao";
import * as service from "./contas.service";

// HTTP das contas de energia, da energia solar e da importação das faturas
// da Energisa. Sem regra e sem SQL.

type ComId = { Params: { id: string } };
type ComMes = { Querystring: { mes: string } };

export async function unidades(request: FastifyRequest) {
  return { unidades: await service.unidades(contextoDe(request)) };
}

export async function meses(request: FastifyRequest) {
  return { meses: await service.meses(contextoDe(request)) };
}

export function faturas(request: FastifyRequest<ComMes>) {
  return service.faturasAte(contextoDe(request), request.query.mes);
}

export function fatura(request: FastifyRequest<ComId>) {
  return service.fatura(contextoDe(request), request.params.id);
}

export async function creditos(request: FastifyRequest<ComMes>) {
  return {
    creditos: await service.creditosDoMes(
      contextoDe(request),
      request.query.mes,
    ),
  };
}

export async function lerFatura(request: FastifyRequest) {
  let form: Awaited<ReturnType<typeof lerFormulario>>;
  try {
    form = await lerFormulario(request, {
      arquivos: 1,
      bytesPorArquivo: service.TAMANHO_MAXIMO,
    });
  } catch (e) {
    if (e instanceof Error && "statusCode" in e && e.statusCode === 413)
      throw new ErroDeNegocio("O arquivo passa de 10 MB.");
    throw e;
  }
  const arquivo = form.arquivos.find((a) => a.campo === "arquivo");
  return service.lerFatura(
    contextoDe(request),
    arquivo ? { nome: arquivo.nome, bytes: arquivo.bytes } : null,
  );
}

export async function previasPendentes(request: FastifyRequest) {
  return { previas: await service.previasPendentes(contextoDe(request)) };
}

export async function cadastrarUnidade(
  request: FastifyRequest<
    ComId & { Body: { apelido: string | null; papel: Papel } }
  >,
) {
  return {
    previa: await service.cadastrarUnidade(
      contextoDe(request),
      request.params.id,
      request.body,
    ),
  };
}

export async function confirmar(
  request: FastifyRequest<ComId & { Body: { motivo: string | null } }>,
) {
  return {
    mensagem: await service.confirmarFatura(
      contextoDe(request),
      request.params.id,
      request.body.motivo,
    ),
  };
}

export async function descartar(request: FastifyRequest<ComId>) {
  return {
    mensagem: await service.descartarFatura(
      contextoDe(request),
      request.params.id,
    ),
  };
}
