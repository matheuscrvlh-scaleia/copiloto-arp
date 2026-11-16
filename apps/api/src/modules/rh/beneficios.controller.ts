import type { RespostaMensagem } from "@arp/shared/contratos/auth";
import type { CorpoDoFormulario } from "@arp/shared/rh/contratos/cadastros";
import type { FastifyReply, FastifyRequest } from "fastify";
import { lerFormulario } from "@/http/formulario";
import { contextoDe } from "@/http/permissao";
import { TAMANHO_MAXIMO } from "./arquivos";
import * as service from "./beneficios.service";

type ComCorpo = FastifyRequest<{ Body: CorpoDoFormulario }>;
type ComId = FastifyRequest<{ Params: { id: string } }>;

const comMensagem = async (m: Promise<string>): Promise<RespostaMensagem> => ({
  mensagem: await m,
});

export const beneficios = (request: FastifyRequest) =>
  service.beneficios(contextoDe(request));

/** Criado: 201 com o id (a tela abre a página dele); alterado: a mensagem. */
export async function salvar(request: ComCorpo, reply: FastifyReply) {
  const r = await service.salvarBeneficio(contextoDe(request), request.body);
  if ("id" in r) reply.code(201);
  return r;
}

export const vincular = (request: ComCorpo) =>
  comMensagem(service.vincular(contextoDe(request), request.body));

export const vincularContrato = (request: ComCorpo) =>
  comMensagem(service.vincularContrato(contextoDe(request), request.body));

export const removerContrato = (request: ComId) =>
  comMensagem(service.removerContrato(contextoDe(request), request.params.id));

export const salvarValorManual = (request: ComCorpo) =>
  comMensagem(service.salvarValorManual(contextoDe(request), request.body));

export const removerVinculo = (request: ComId) =>
  comMensagem(service.removerVinculo(contextoDe(request), request.params.id));

export const vincularPelaFolha = (request: ComId) =>
  comMensagem(
    service.vincularPelaFolha(contextoDe(request), request.params.id),
  );

export const salvarValoresDoMes = (request: ComCorpo) =>
  comMensagem(service.salvarValoresDoMes(contextoDe(request), request.body));

export async function importarValoresDoMes(
  request: FastifyRequest,
): Promise<RespostaMensagem> {
  const ctx = contextoDe(request);
  // Um pouco acima do limite: quem passa recebe a mensagem do service.
  const form = await lerFormulario(request, {
    arquivos: 1,
    bytesPorArquivo: TAMANHO_MAXIMO + 1024 * 1024,
  });
  return comMensagem(
    service.importarValoresDoMes(
      ctx,
      form.campos,
      form.arquivos.find((a) => a.campo === "arquivo"),
    ),
  );
}

export const salvarTotalDoMes = (request: ComCorpo) =>
  comMensagem(service.salvarTotalDoMes(contextoDe(request), request.body));
