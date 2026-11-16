import type { RespostaMensagem } from "@arp/shared/os/contratos/base";
import { entradaOrdemDosAmbientes } from "@arp/shared/os/contratos/vistorias";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ErroDeValidacao } from "@/erros";
import { lerFormulario } from "@/http/formulario";
import { contextoDe } from "@/http/permissao";
import { disposicao } from "@/infra/arquivos/http";
import type { LaudoGerado } from "./pdf/laudo";
import * as publica from "./vistoria-publica.service";
import * as service from "./vistorias.service";
import * as acoes from "./vistorias-acoes.service";

// HTTP das vistorias e do link do locatário: lê a requisição e chama o
// service. Os formulários vêm validados no service com os rótulos de antes;
// fotos e assinaturas chegam em multipart.

type ComId = { Params: { id: string } };
type ComAmbiente = { Params: { id: string; ambiente: string } };
type ComParte = { Params: { id: string; parte: "locador" | "locatario" } };
type ComToken = { Params: { token: string } };
type Busca = { Querystring: Record<string, unknown> };

/** Teto do multipart: acima do que a tela aceita (o service responde). */
const LIMITES = { arquivos: 1, bytesPorArquivo: 10 * 1024 * 1024 };

const textoDe = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

function enviarPdf(
  reply: FastifyReply,
  pdf: LaudoGerado,
  modo: "inline" | "attachment",
  semReferencia = false,
) {
  reply
    .header("content-type", "application/pdf")
    .header("content-disposition", disposicao(modo, pdf.nome))
    .header("cache-control", "private, no-store");
  if (semReferencia) reply.header("referrer-policy", "no-referrer");
  return reply.send(Buffer.from(pdf.bytes));
}

export function lista(request: FastifyRequest<Busca>) {
  return service.lerVistorias(contextoDe(request), request.query);
}

export function exportar(request: FastifyRequest<Busca>) {
  return service.exportarVistorias(contextoDe(request), request.query);
}

export function nova(request: FastifyRequest) {
  return service.lerNovaVistoria(contextoDe(request));
}

export async function iniciar(request: FastifyRequest<{ Body: unknown }>) {
  const id = await acoes.iniciarVistoria(contextoDe(request), request.body);
  return { mensagem: "Vistoria criada.", id };
}

export function detalhe(request: FastifyRequest<ComId>) {
  return service.lerVistoria(contextoDe(request), request.params.id);
}

export async function salvar(
  request: FastifyRequest<ComId & { Body: unknown }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await acoes.salvarVistoria(
      contextoDe(request),
      request.params.id,
      request.body,
    ),
  };
}

export async function duplicar(request: FastifyRequest<ComId>) {
  const id = await acoes.duplicarVistoria(
    contextoDe(request),
    request.params.id,
  );
  return { mensagem: "Vistoria duplicada.", id };
}

export async function laudo(
  request: FastifyRequest<
    ComId & { Querystring: { entrada?: string; baixar?: string } }
  >,
  reply: FastifyReply,
) {
  const pdf = await service.laudoDaVistoria(
    contextoDe(request),
    request.params.id,
    request.query.entrada === "1",
  );
  return enviarPdf(
    reply,
    pdf,
    request.query.baixar === "1" ? "attachment" : "inline",
  );
}

export function envio(request: FastifyRequest<ComId>) {
  return acoes.prepararEnvio(contextoDe(request), request.params.id);
}

export function linkDeAssinatura(request: FastifyRequest<ComId>) {
  return acoes.enviarParaAssinatura(contextoDe(request), request.params.id);
}

export function adicionarAmbiente(
  request: FastifyRequest<ComId & { Body: unknown }>,
) {
  return acoes.adicionarAmbiente(
    contextoDe(request),
    request.params.id,
    request.body,
  );
}

export async function ordenarAmbientes(
  request: FastifyRequest<ComId & { Body: unknown }>,
): Promise<RespostaMensagem> {
  service.exigirVistorias(contextoDe(request));
  const d = entradaOrdemDosAmbientes.safeParse(request.body);
  if (!d.success) throw new ErroDeValidacao("Ordem inválida.");
  return {
    mensagem: await acoes.ordenarAmbientes(
      contextoDe(request),
      request.params.id,
      d.data.ids,
    ),
  };
}

export async function salvarAmbiente(
  request: FastifyRequest<ComAmbiente & { Body: unknown }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await acoes.salvarAmbiente(
      contextoDe(request),
      request.params.id,
      request.params.ambiente,
      request.body,
    ),
  };
}

export async function removerAmbiente(
  request: FastifyRequest<ComId>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await acoes.removerAmbiente(
      contextoDe(request),
      request.params.id,
    ),
  };
}

export async function enviarFoto(request: FastifyRequest<ComAmbiente>) {
  const form = await lerFormulario(request, LIMITES);
  return acoes.enviarFoto(
    contextoDe(request),
    request.params.id,
    request.params.ambiente,
    form.arquivos.find((a) => a.campo === "arquivo"),
  );
}

export async function removerFoto(
  request: FastifyRequest<ComId>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await acoes.removerFoto(contextoDe(request), request.params.id),
  };
}

export async function salvarAssinatura(request: FastifyRequest<ComParte>) {
  const form = await lerFormulario(request, LIMITES);
  return acoes.salvarAssinatura(
    contextoDe(request),
    request.params.id,
    request.params.parte,
    form.arquivos.find((a) => a.campo === "arquivo"),
  );
}

export async function removerAssinatura(
  request: FastifyRequest<ComParte>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await acoes.removerAssinatura(
      contextoDe(request),
      request.params.id,
      request.params.parte,
    ),
  };
}

// ---------------------------------------------------------------------------
// Link do locatário (sem login)
// ---------------------------------------------------------------------------

export function paginaPublica(request: FastifyRequest<ComToken>) {
  return publica.paginaDaVistoria(request.params.token);
}

export async function laudoPublico(
  request: FastifyRequest<ComToken>,
  reply: FastifyReply,
) {
  const pdf = await publica.laudoPeloLink(request.params.token);
  return enviarPdf(reply, pdf, "inline", true);
}

export async function assinarPublico(
  request: FastifyRequest<ComToken>,
): Promise<RespostaMensagem> {
  const form = await lerFormulario(request, LIMITES);
  const campos = Object.fromEntries(
    Object.entries(form.campos).map(([k, v]) => [k, textoDe(v)]),
  );
  return {
    mensagem: await publica.assinarPeloLink(
      request.params.token,
      campos,
      form.arquivos.find((a) => a.campo === "assinatura"),
    ),
  };
}
