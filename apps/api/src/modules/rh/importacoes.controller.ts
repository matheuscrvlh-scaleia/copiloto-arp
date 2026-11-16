import type { RespostaMensagem } from "@arp/shared/contratos/auth";
import type { CorpoDoFormulario } from "@arp/shared/rh/contratos/cadastros";
import type { FastifyRequest } from "fastify";
import { lerFormulario } from "@/http/formulario";
import { contextoDe } from "@/http/permissao";
import { TAMANHO_MAXIMO } from "./arquivos";
import * as service from "./importacoes.service";

type ComTexto = FastifyRequest<{ Body: Record<string, string> }>;

/** Um pouco acima do limite: quem passa recebe a mensagem do service. */
const LIMITES = { arquivos: 1, bytesPorArquivo: TAMANHO_MAXIMO + 1024 * 1024 };

export const importacoes = (request: FastifyRequest) =>
  service.importacoes(contextoDe(request));

export async function lerFolha(request: FastifyRequest) {
  const ctx = contextoDe(request);
  const form = await lerFormulario(request, LIMITES);
  return service.lerFolha(
    ctx,
    form.arquivos.find((a) => a.campo === "arquivo"),
  );
}

export async function confirmarFolha(
  request: ComTexto,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.confirmarFolha(contextoDe(request), request.body),
  };
}

export async function excluirFolha(
  request: FastifyRequest<{ Params: { id: string } }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.excluirFolha(
      contextoDe(request),
      request.params.id,
    ),
  };
}

export async function classificarRubrica(
  request: FastifyRequest<{ Body: CorpoDoFormulario }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.classificarRubrica(
      contextoDe(request),
      request.body,
    ),
  };
}

export const folhaParaEditar = (
  request: FastifyRequest<{ Params: { id: string } }>,
) => service.folhaParaEditar(contextoDe(request), request.params.id);

export async function salvarPessoaDaFolha(
  request: FastifyRequest<{
    Params: { id: string; colaborador: string };
    Body: CorpoDoFormulario;
  }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.salvarPessoaDaFolha(
      contextoDe(request),
      request.params.id,
      request.params.colaborador,
      request.body,
    ),
  };
}

export async function lerTabelaPlano(request: FastifyRequest) {
  const ctx = contextoDe(request);
  const form = await lerFormulario(request, LIMITES);
  return service.lerTabelaPlano(
    ctx,
    form.campos,
    form.arquivos.find((a) => a.campo === "arquivo"),
  );
}

export async function confirmarTabelaPlano(
  request: ComTexto,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.confirmarTabelaPlano(
      contextoDe(request),
      request.body,
    ),
  };
}

export async function salvarFaixasPlano(
  request: FastifyRequest<{
    Params: { id: string };
    Body: CorpoDoFormulario;
  }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.salvarFaixasPlano(
      contextoDe(request),
      request.params.id,
      request.body,
    ),
  };
}
