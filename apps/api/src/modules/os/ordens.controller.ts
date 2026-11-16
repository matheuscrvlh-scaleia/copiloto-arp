import type { RespostaMensagem } from "@arp/shared/os/contratos/base";
import {
  type BlocoDaOS,
  type ConsultaDoPdf,
  entradaArquivos,
  entradaAssinatura,
  entradaCustoTerceirizado,
  entradaEnvioAoTerceirizado,
  entradaExecucao,
  entradaMaterial,
  entradaOutrosCustos,
  entradaRateio,
  entradaResultado,
  entradaSessao,
  entradaUsarDoTerceirizado,
  type PaginaTerceirizado,
  type RespostaDaOS,
  type RespostaOrdens,
  ROTULOS_SESSAO,
} from "@arp/shared/os/contratos/ordens";
import type { Planilha } from "@arp/shared/os/contratos/visoes";
import { MAXIMO_LOTE_PDF } from "@arp/shared/os/ordem";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { z } from "zod";
import { ErroDeNegocio, ErroDeValidacao, ErroNaoEncontrado } from "@/erros";
import { lerFormulario } from "@/http/formulario";
import { contextoDe } from "@/http/permissao";
import { disposicao } from "@/infra/arquivos/http";
import { UUID } from "./alvo";
import * as service from "./ordens.service";
import * as acoes from "./ordens-acoes.service";
import * as arquivos from "./ordens-arquivos.service";
import * as consulta from "./ordens-consulta.service";
import { gerarPdfOS } from "./ordens-pdf";
import * as publica from "./ordens-publica.service";
import * as terceirizado from "./ordens-terceirizado.service";

// HTTP das Ordens de serviço. Os formulários do bloco chegam como a tela
// manda (texto) e são validados aqui com o schema do contrato, para a
// mensagem sair com o rótulo do campo, como antes.

type Livre = Record<string, unknown>;
type ComId = { Params: { id: string } };
type ComItem = { Params: { id: string; item: string } };
type ComCorpo = ComId & { Body: Livre };
type ComToken = { Params: { token: string } };

/** Teto do multipart: acima do que a tela aceita, para o service responder. */
const LIMITES = { arquivos: 30, bytesPorArquivo: 15 * 1024 * 1024 };

/** O primeiro erro, com o rótulo do campo (ou a mensagem fixa da ação). */
function validar<S extends z.ZodType>(
  schema: S,
  dados: unknown,
  rotulos: Record<string, string> | string = {},
): z.infer<S> {
  const d = schema.safeParse(dados);
  if (d.success) return d.data;
  if (typeof rotulos === "string") throw new ErroDeValidacao(rotulos);
  const issue = d.error.issues[0];
  const campo = String(issue?.path[0] ?? "");
  throw new ErroDeValidacao(
    `${rotulos[campo] ?? (campo || "Campo")}: ${issue?.message ?? "inválido"}`,
  );
}

// ---------------------------------------------------------------------------
// Lista, exportação e PDF
// ---------------------------------------------------------------------------

export function listar(
  request: FastifyRequest<{ Querystring: Livre }>,
): Promise<RespostaOrdens> {
  return consulta.listar(contextoDe(request), request.query);
}

export function exportar(
  request: FastifyRequest<{ Querystring: Livre }>,
): Promise<Planilha> {
  return consulta.exportar(contextoDe(request), request.query);
}

/**
 * PDF da OS (4.16 C): ?ids=<id>[,<id>…], uma OS por folha. &fotos=0 imprime
 * sem as fotos. As OS são lidas pelo RLS (quem não vê a OS não a recebe;
 * valores só com os.custos).
 */
export async function pdf(
  request: FastifyRequest<{ Querystring: ConsultaDoPdf }>,
  reply: FastifyReply,
) {
  const ids = [
    ...new Set(
      (request.query.ids ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter((id) => UUID.test(id)),
    ),
  ];
  if (!ids.length) throw new ErroDeValidacao("Escolha pelo menos uma OS.");
  if (ids.length > MAXIMO_LOTE_PDF)
    throw new ErroDeValidacao(
      `Imprima no máximo ${MAXIMO_LOTE_PDF} OS por vez.`,
    );
  const arquivo = await gerarPdfOS(contextoDe(request), ids, {
    fotos: request.query.fotos !== "0",
  });
  if (!arquivo) throw new ErroNaoEncontrado("OS não encontrada.");
  return reply
    .header("content-type", "application/pdf")
    .header("content-disposition", disposicao("inline", arquivo.nome))
    .header("cache-control", "private, no-store")
    .send(Buffer.from(arquivo.bytes));
}

// ---------------------------------------------------------------------------
// Bloco da OS
// ---------------------------------------------------------------------------

export function bloco(request: FastifyRequest<ComId>): Promise<BlocoDaOS> {
  return service.blocoDaOS(contextoDe(request), request.params.id);
}

export function iniciarTempo(
  request: FastifyRequest<ComId>,
): Promise<RespostaDaOS> {
  return acoes.iniciarTempo(contextoDe(request), request.params.id);
}

export function pausarTempo(
  request: FastifyRequest<ComCorpo>,
): Promise<RespostaDaOS> {
  return acoes.pausarTempo(
    contextoDe(request),
    request.params.id,
    request.body.finalizar === "1",
  );
}

export function salvarSessao(
  request: FastifyRequest<ComCorpo>,
): Promise<RespostaDaOS> {
  return acoes.salvarSessao(
    contextoDe(request),
    request.params.id,
    validar(entradaSessao, request.body, ROTULOS_SESSAO),
  );
}

export function excluirSessao(
  request: FastifyRequest<ComItem>,
): Promise<RespostaDaOS> {
  const { id, item } = request.params;
  return acoes.excluirSessao(contextoDe(request), id, item);
}

export function salvarExecucao(
  request: FastifyRequest<ComCorpo>,
): Promise<RespostaDaOS> {
  return acoes.salvarExecucao(
    contextoDe(request),
    request.params.id,
    validar(entradaExecucao, request.body, {
      visita_data: "Data da visita",
      visita_periodo: "Período",
    }),
  );
}

export function salvarMaterial(
  request: FastifyRequest<ComCorpo>,
): Promise<RespostaDaOS> {
  return acoes.salvarMaterial(
    contextoDe(request),
    request.params.id,
    validar(entradaMaterial, request.body, { descricao: "Material" }),
  );
}

export function excluirMaterial(
  request: FastifyRequest<ComItem>,
): Promise<RespostaDaOS> {
  const { id, item } = request.params;
  return acoes.excluirMaterial(contextoDe(request), id, item);
}

export function salvarRateio(
  request: FastifyRequest<ComCorpo>,
): Promise<RespostaDaOS> {
  return acoes.salvarRateio(
    contextoDe(request),
    request.params.id,
    validar(entradaRateio, request.body, { rateio_regra: "Regra" }),
  );
}

export function salvarCustoTerceirizado(
  request: FastifyRequest<ComCorpo>,
): Promise<RespostaDaOS> {
  return acoes.salvarCustoTerceirizado(
    contextoDe(request),
    request.params.id,
    validar(entradaCustoTerceirizado, request.body),
  );
}

export function salvarOutrosCustos(
  request: FastifyRequest<ComCorpo>,
): Promise<RespostaDaOS> {
  return acoes.salvarOutrosCustos(
    contextoDe(request),
    request.params.id,
    validar(entradaOutrosCustos, request.body).outros,
  );
}

export function salvarResultado(
  request: FastifyRequest<ComCorpo>,
): Promise<RespostaDaOS> {
  return acoes.salvarResultado(
    contextoDe(request),
    request.params.id,
    validar(entradaResultado, request.body, { solucao: "Solução" }),
  );
}

export function concluir(
  request: FastifyRequest<ComId>,
): Promise<RespostaDaOS> {
  return acoes.concluirOS(contextoDe(request), request.params.id);
}

export async function enviarArquivos(
  request: FastifyRequest<ComId>,
): Promise<RespostaDaOS> {
  const form = await lerFormulario(request, LIMITES);
  if (!UUID.test(request.params.id)) throw new ErroDeNegocio("Envio inválido.");
  const d = validar(entradaArquivos, form.campos, "Envio inválido.");
  return arquivos.enviarArquivos(
    contextoDe(request),
    request.params.id,
    d.categoria,
    form.arquivos.filter((a) => a.campo === "arquivos" && a.bytes.length > 0),
  );
}

export function removerArquivo(
  request: FastifyRequest<ComItem>,
): Promise<RespostaDaOS> {
  const { id, item } = request.params;
  if (!UUID.test(id) || !UUID.test(item))
    throw new ErroDeNegocio("Arquivo inválido.");
  return arquivos.removerArquivo(contextoDe(request), id, item);
}

export async function assinar(
  request: FastifyRequest<ComId>,
): Promise<RespostaDaOS> {
  const form = await lerFormulario(request, LIMITES);
  const d = entradaAssinatura.safeParse(form.campos);
  if (!d.success || !UUID.test(request.params.id))
    throw new ErroDeValidacao(
      `Nome: ${(d.success ? null : d.error.issues[0]?.message) ?? "inválido"}`,
    );
  return arquivos.assinarOS(
    contextoDe(request),
    request.params.id,
    d.data.nome,
    form.arquivos.find((a) => a.campo === "assinatura"),
  );
}

export function enviarAoTerceirizado(
  request: FastifyRequest<ComCorpo>,
): Promise<RespostaDaOS> {
  if (!UUID.test(request.params.id)) throw new ErroDeNegocio("Envio inválido.");
  return terceirizado.enviarAoTerceirizado(
    contextoDe(request),
    request.params.id,
    validar(entradaEnvioAoTerceirizado, request.body, "Envio inválido."),
  );
}

export function cancelarLink(
  request: FastifyRequest<ComId>,
): Promise<RespostaDaOS> {
  return terceirizado.cancelarLinkTerceirizado(
    contextoDe(request),
    request.params.id,
  );
}

export function usarDoTerceirizado(
  request: FastifyRequest<ComCorpo>,
): Promise<RespostaDaOS> {
  if (!UUID.test(request.params.id))
    throw new ErroDeNegocio("Pedido inválido.");
  return terceirizado.usarDoTerceirizado(
    contextoDe(request),
    request.params.id,
    validar(entradaUsarDoTerceirizado, request.body, "Pedido inválido."),
  );
}

export function aprovarOrcamento(
  request: FastifyRequest<ComId>,
): Promise<RespostaDaOS> {
  return terceirizado.aprovarOrcamento(contextoDe(request), request.params.id);
}

// ---------------------------------------------------------------------------
// Link do terceirizado (sem login)
// ---------------------------------------------------------------------------

export async function paginaPublica(
  request: FastifyRequest<ComToken>,
): Promise<PaginaTerceirizado> {
  const p = await publica.paginaDoTerceirizado(request.params.token);
  if (!p) throw new ErroNaoEncontrado("Este link não está mais ativo.");
  return p;
}

const mensagem = async (m: Promise<string>): Promise<RespostaMensagem> => ({
  mensagem: await m,
});

type ComTokenECorpo = ComToken & { Body: Livre };

export function aceitar(
  request: FastifyRequest<ComToken>,
): Promise<RespostaMensagem> {
  return mensagem(publica.aceitar(request.params.token));
}

export function recusar(
  request: FastifyRequest<ComTokenECorpo>,
): Promise<RespostaMensagem> {
  return mensagem(publica.recusar(request.params.token, request.body));
}

export function cheguei(
  request: FastifyRequest<ComTokenECorpo>,
): Promise<RespostaMensagem> {
  return mensagem(publica.cheguei(request.params.token, request.body));
}

export function terminei(
  request: FastifyRequest<ComTokenECorpo>,
): Promise<RespostaMensagem> {
  return mensagem(publica.terminei(request.params.token, request.body));
}

export function relatorio(
  request: FastifyRequest<ComTokenECorpo>,
): Promise<RespostaMensagem> {
  return mensagem(publica.salvarRelatorio(request.params.token, request.body));
}

export async function arquivosDoLink(
  request: FastifyRequest<ComToken>,
): Promise<RespostaMensagem> {
  const form = await lerFormulario(request, LIMITES);
  return mensagem(
    publica.enviarArquivosDoTerceirizado(
      request.params.token,
      form.campos.categoria,
      form.arquivos.filter((a) => a.campo === "arquivos" && a.bytes.length > 0),
    ),
  );
}

export async function assinaturaDoLink(
  request: FastifyRequest<ComToken>,
): Promise<RespostaMensagem> {
  const form = await lerFormulario(request, LIMITES);
  return mensagem(
    publica.assinarPeloLink(
      request.params.token,
      form.campos,
      form.arquivos.find((a) => a.campo === "assinatura"),
    ),
  );
}
