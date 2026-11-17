import {
  entradaAnexo,
  entradaAssinatura,
  type entradaAtivacao,
  type entradaDispensa,
  type entradaPrazo,
  type entradaRascunho,
  type entradaTransferencia,
} from "@arp/shared/sustentabilidade/contratos/entrevistas";
import type { FastifyRequest } from "fastify";
import type { z } from "zod";
import { ErroDeNegocio, ErroDeValidacao } from "@/erros";
import { lerFormulario } from "@/http/formulario";
import { contextoDe } from "@/http/permissao";
import * as service from "./entrevistas.service";
import * as acoes from "./entrevistas-acoes.service";

// HTTP das entrevistas de resíduos. Sem regra e sem SQL.

type ComId = { Params: { id: string } };
type Corpo<T extends z.ZodType> = { Body: z.output<T> };
const ok = (mensagem: string) => ({ mensagem });

export function controle(request: FastifyRequest) {
  return service.dadosDoControle(contextoDe(request));
}

export function ficha(request: FastifyRequest<ComId>) {
  return service.fichaDoContrato(contextoDe(request), request.params.id);
}

export function salva(request: FastifyRequest<ComId>) {
  return service.respostasDaEntrevista(contextoDe(request), request.params.id);
}

export function aplicar(request: FastifyRequest<ComId>) {
  return service.dadosDeAplicar(contextoDe(request), request.params.id);
}

export function respostas(
  request: FastifyRequest<{ Querystring: { de: string; ate: string } }>,
) {
  return service.respostasDoPeriodo(
    contextoDe(request),
    request.query.de,
    request.query.ate,
  );
}

export function rascunho(
  request: FastifyRequest<Corpo<typeof entradaRascunho>>,
) {
  return acoes.salvarRascunho(contextoDe(request), request.body);
}

/** Formulário com um arquivo; maior que o limite vira a mensagem dada. */
async function formulario(
  request: FastifyRequest,
  limite: number,
  grandeDemais: string,
) {
  try {
    // Um byte a mais que o limite: o arquivo no limite ainda passa.
    const f = await lerFormulario(request, {
      arquivos: 1,
      bytesPorArquivo: limite + 1,
    });
    const a = f.arquivos[0];
    return {
      campos: f.campos,
      arquivo: a
        ? { nome: a.nome, tipo: a.tipo, bytes: new Uint8Array(a.bytes) }
        : undefined,
    };
  } catch (e) {
    if (e instanceof Error && "statusCode" in e && e.statusCode === 413)
      throw new ErroDeNegocio(grandeDemais);
    throw e;
  }
}

export async function assinar(request: FastifyRequest) {
  const f = await formulario(
    request,
    acoes.ASSINATURA_MAX,
    "Assinatura grande demais.",
  );
  const d = entradaAssinatura.safeParse(f.campos);
  if (!d.success)
    throw new ErroDeValidacao(
      `Nome: ${d.error.issues[0]?.message ?? "inválido"}`,
    );
  return ok(
    await acoes.assinarEntrevista(contextoDe(request), d.data, f.arquivo),
  );
}

export function concluir(request: FastifyRequest<{ Body: { chave: string } }>) {
  return acoes.concluirEntrevista(contextoDe(request), request.body.chave);
}

export async function interesse(
  request: FastifyRequest<{ Body: { contratoId: string } }>,
) {
  return ok(
    await acoes.registrarInteresse(
      contextoDe(request),
      request.body.contratoId,
    ),
  );
}

export async function dispensar(
  request: FastifyRequest<Corpo<typeof entradaDispensa>>,
) {
  return ok(await acoes.dispensarEntrevista(contextoDe(request), request.body));
}

export async function desfazerDispensa(
  request: FastifyRequest<{ Body: { contrato_id: string } }>,
) {
  return ok(
    await acoes.desfazerDispensa(contextoDe(request), request.body.contrato_id),
  );
}

export async function ativacao(
  request: FastifyRequest<Corpo<typeof entradaAtivacao>>,
) {
  return ok(await acoes.corrigirAtivacao(contextoDe(request), request.body));
}

export async function prazo(
  request: FastifyRequest<Corpo<typeof entradaPrazo>>,
) {
  return ok(await acoes.prazoDoContrato(contextoDe(request), request.body));
}

export async function transferir(
  request: FastifyRequest<Corpo<typeof entradaTransferencia>>,
) {
  return ok(
    await acoes.transferirEntrevista(contextoDe(request), request.body),
  );
}

export async function anexar(request: FastifyRequest) {
  const f = await formulario(
    request,
    acoes.ANEXO_MAX_MB * 1024 * 1024,
    `O arquivo passa de ${acoes.ANEXO_MAX_MB} MB.`,
  );
  const d = entradaAnexo.safeParse(f.campos);
  if (!d.success) throw new ErroDeValidacao("Entrevista inválida.");
  return ok(
    await acoes.anexarPapel(
      contextoDe(request),
      d.data.entrevista_id,
      f.arquivo,
    ),
  );
}
