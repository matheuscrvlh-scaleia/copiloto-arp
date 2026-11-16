import type { RespostaMensagem } from "@arp/shared/comercial/contratos/base";
import type {
  EntradaConfirmacao,
  RespostaConfirmacao,
  RespostaImportacoes,
  RespostaPrevia,
  RespostaTiposImportacao,
} from "@arp/shared/comercial/contratos/importacoes";
import {
  CAMPO_ARQUIVO,
  LIMITE_ARQUIVO_MB,
  type TipoImportacao,
} from "@arp/shared/comercial/importacao";
import type { FastifyRequest } from "fastify";
import { lerFormulario } from "@/http/formulario";
import { contextoDe } from "@/http/permissao";
import * as service from "./importacoes.service";
import { IMPORTADORES } from "./importacoes.tipos";

type ComTipo = { Params: { tipo: TipoImportacao } };

export function importacoes(
  request: FastifyRequest,
): Promise<RespostaImportacoes> {
  return service.importacoes(contextoDe(request));
}

export async function tipos(
  request: FastifyRequest,
): Promise<RespostaTiposImportacao> {
  return { tipos: await service.tiposQuePodeImportar(contextoDe(request)) };
}

export async function previa(
  request: FastifyRequest<ComTipo>,
): Promise<RespostaPrevia> {
  const ctx = contextoDe(request);
  // Um pouco acima do limite: quem passa recebe a mensagem do service.
  const form = await lerFormulario(request, {
    arquivos: 1,
    bytesPorArquivo: (LIMITE_ARQUIVO_MB + 1) * 1024 * 1024,
  });
  return service.prepararPrevia(
    ctx,
    IMPORTADORES,
    request.params.tipo,
    form.arquivos.find((a) => a.campo === CAMPO_ARQUIVO),
  );
}

export function confirmar(
  request: FastifyRequest<ComTipo & { Body: EntradaConfirmacao }>,
): Promise<RespostaConfirmacao> {
  return service.confirmarImportacao(
    contextoDe(request),
    IMPORTADORES,
    request.params.tipo,
    request.body,
  );
}

export async function desfazer(
  request: FastifyRequest<{ Params: { id: string } }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.desfazerImportacao(
      contextoDe(request),
      request.params.id,
    ),
  };
}
