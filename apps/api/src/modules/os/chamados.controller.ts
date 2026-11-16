import type { RespostaMensagem } from "@arp/shared/os/contratos/base";
import {
  type ContatoSalvo,
  type DetalheChamado,
  type EntradaAcao,
  type EntradaAlteracao,
  type EntradaAndarDestino,
  type EntradaChecklist,
  type EntradaMoverDestino,
  type EntradaSeguir,
  type EntradaTarefaDestino,
  entradaComentario,
  entradaNovoChamado,
  type RespostaCriacao,
  ROTULOS_NOVO,
} from "@arp/shared/os/contratos/chamados";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { z } from "zod";
import { ErroDeValidacao } from "@/erros";
import { lerFormulario } from "@/http/formulario";
import { contextoDe } from "@/http/permissao";
import * as detalhes from "./chamado-detalhe.service";
import * as service from "./chamados-acoes.service";

// HTTP dos chamados: lê a requisição validada e chama o service. Os dois
// formulários com arquivo (abrir e comentar) chegam em multipart e são
// validados aqui com o schema do contrato.

type ComId = { Params: { id: string } };

/**
 * Teto do multipart: acima do que a tela aceita (10 arquivos de 4 MB por
 * campo), para o service responder com a mensagem de sempre em vez de 413.
 */
const LIMITES = { arquivos: 30, bytesPorArquivo: 15 * 1024 * 1024 };

/** Valida os campos do formulário: o primeiro erro, com o rótulo do campo. */
function validar<S extends z.ZodType>(
  schema: S,
  dados: unknown,
  rotulos: Record<string, string>,
): z.infer<S> {
  const d = schema.safeParse(dados);
  if (d.success) return d.data;
  const issue = d.error.issues[0];
  const campo = String(issue?.path[0] ?? "");
  throw new ErroDeValidacao(
    `${rotulos[campo] ?? (campo || "Campo")}: ${issue?.message ?? "inválido"}`,
  );
}

export function detalhe(
  request: FastifyRequest<ComId>,
): Promise<DetalheChamado> {
  return detalhes.carregarDetalhe(contextoDe(request), request.params.id);
}

export async function contatos(
  request: FastifyRequest,
): Promise<{ contatos: ContatoSalvo[] }> {
  return { contatos: await detalhes.contatosSalvos(contextoDe(request)) };
}

export async function abrir(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<RespostaCriacao> {
  const form = await lerFormulario(request, LIMITES);
  const v = validar(
    entradaNovoChamado,
    {
      ...form.campos,
      vinculado_numero: form.campos.vinculado_numero ?? "",
      responsavel: form.campos.responsavel ?? "",
    },
    ROTULOS_NOVO,
  );
  const criado = await service.abrirChamado(contextoDe(request), v, form);
  reply.code(201);
  return criado;
}

export async function agir(
  request: FastifyRequest<ComId & { Body: EntradaAcao }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.agir(
      contextoDe(request),
      request.params.id,
      request.body,
    ),
  };
}

export async function alterar(
  request: FastifyRequest<ComId & { Body: EntradaAlteracao }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.alterarChamado(
      contextoDe(request),
      request.params.id,
      request.body,
    ),
  };
}

export async function checklist(
  request: FastifyRequest<ComId & { Body: EntradaChecklist }>,
): Promise<RespostaMensagem> {
  await service.marcarChecklist(
    contextoDe(request),
    request.params.id,
    request.body,
  );
  return { mensagem: "" };
}

export async function comentar(
  request: FastifyRequest<ComId>,
  reply: FastifyReply,
): Promise<RespostaMensagem> {
  const form = await lerFormulario(request, LIMITES);
  const d = validar(
    entradaComentario,
    {
      texto: form.campos.texto ?? "",
      visivel_lojista: form.campos.visivel_lojista ?? "0",
    },
    { texto: "Comentário" },
  );
  await service.comentar(
    contextoDe(request),
    request.params.id,
    d,
    form.arquivos.filter((a) => a.campo === "arquivos" && a.bytes.length > 0),
  );
  reply.code(201);
  return { mensagem: "Enviado." };
}

export async function seguir(
  request: FastifyRequest<ComId & { Body: EntradaSeguir }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.seguirChamado(
      contextoDe(request),
      request.params.id,
      request.body.ligar === "1",
    ),
  };
}

export async function marcarLido(
  request: FastifyRequest<ComId>,
): Promise<RespostaMensagem> {
  await service.marcarLido(contextoDe(request), request.params.id);
  return { mensagem: "Marcado como lido." };
}

export async function moverDestino(
  request: FastifyRequest<ComId & { Body: EntradaMoverDestino }>,
): Promise<RespostaMensagem> {
  await service.moverDestino(
    contextoDe(request),
    request.params.id,
    request.body.passo,
  );
  return { mensagem: "" };
}

export async function andarDestino(
  request: FastifyRequest<ComId & { Body: EntradaAndarDestino }>,
): Promise<RespostaMensagem> {
  await service.andarDestino(
    contextoDe(request),
    request.params.id,
    request.body.acao,
  );
  return { mensagem: "" };
}

export async function tarefaDoDestino(
  request: FastifyRequest<ComId & { Body: EntradaTarefaDestino }>,
): Promise<RespostaMensagem> {
  await service.definirTarefaDestino(
    contextoDe(request),
    request.params.id,
    request.body.tarefa,
  );
  return { mensagem: "" };
}
