import type {
  consultaDosFormularios,
  entradaAlterarFormulario,
  entradaAlterarRascunho,
  entradaCriarFormulario,
  entradaPublicar,
  entradaRestaurar,
  entradaVersaoOtimista,
} from "@arp/shared/sustentabilidade/contratos/formularios";
import type { FastifyRequest } from "fastify";
import type { z } from "zod";
import { contextoDe } from "@/http/permissao";
import * as service from "./formularios.service";

// HTTP dos formulários específicos (editor e lista do programa). Sem regra e
// sem SQL.

type Id = { id: string };

export async function questionario(request: FastifyRequest) {
  return { id: await service.questionarioDaTela(contextoDe(request)) };
}

export async function doPrograma(
  request: FastifyRequest<{
    Querystring: z.infer<typeof consultaDosFormularios>;
  }>,
) {
  return {
    formularios: await service.formulariosDoProgramaDaTela(
      contextoDe(request),
      request.query.programa,
    ),
  };
}

export async function editor(request: FastifyRequest<{ Params: Id }>) {
  const d = await service.dadosDoEditor(contextoDe(request), request.params.id);
  return d === "sem_acesso"
    ? { editor: null, semAcesso: true }
    : { editor: d, semAcesso: false };
}

export function versao(
  request: FastifyRequest<{ Params: Id & { versao: number } }>,
) {
  return service.lerVersao(
    contextoDe(request),
    request.params.id,
    request.params.versao,
  );
}

export function alterarRascunho(
  request: FastifyRequest<{
    Params: Id;
    Body: z.infer<typeof entradaAlterarRascunho>;
  }>,
) {
  return service.alterarRascunho(
    contextoDe(request),
    request.params.id,
    request.body,
  );
}

export function descartarRascunho(
  request: FastifyRequest<{
    Params: Id;
    Body: z.infer<typeof entradaVersaoOtimista>;
  }>,
) {
  return service.descartarRascunho(
    contextoDe(request),
    request.params.id,
    request.body.atualizadoEm,
  );
}

export function restaurar(
  request: FastifyRequest<{
    Params: Id;
    Body: z.infer<typeof entradaRestaurar>;
  }>,
) {
  return service.restaurarComoRascunho(
    contextoDe(request),
    request.params.id,
    request.body,
  );
}

export function publicar(
  request: FastifyRequest<{
    Params: Id;
    Body: z.infer<typeof entradaPublicar>;
  }>,
) {
  return service.publicarFormulario(
    contextoDe(request),
    request.params.id,
    request.body,
  );
}

export function criar(
  request: FastifyRequest<{ Body: z.infer<typeof entradaCriarFormulario> }>,
) {
  return service.criarFormularioDePrograma(
    contextoDe(request),
    request.body.programaId,
    request.body.nome,
  );
}

export function alterar(
  request: FastifyRequest<{
    Params: Id;
    Body: z.infer<typeof entradaAlterarFormulario>;
  }>,
) {
  const ctx = contextoDe(request);
  const { nome, ativo } = request.body;
  return nome !== undefined
    ? service.renomearFormulario(ctx, request.params.id, nome)
    : service.alternarFormularioAtivo(ctx, request.params.id, ativo === true);
}

export function duplicar(request: FastifyRequest<{ Params: Id }>) {
  return service.duplicarFormulario(contextoDe(request), request.params.id);
}

export function excluir(request: FastifyRequest<{ Params: Id }>) {
  return service.excluirFormulario(contextoDe(request), request.params.id);
}
