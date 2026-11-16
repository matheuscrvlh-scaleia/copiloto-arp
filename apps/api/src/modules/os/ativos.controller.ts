import type {
  FichaDoAtivo,
  OpcoesDoCadastro,
  RespostaAtivos,
  RespostaSaidas,
} from "@arp/shared/os/contratos/ativos";
import {
  entradaAlternarPlano,
  entradaAnexoAtivo,
  entradaBaixa,
  entradaCategoriaAtivo,
  entradaDesfazerSaida,
  entradaPlano,
  entradaSituacao,
  ROTULOS_ATIVO,
} from "@arp/shared/os/contratos/ativos";
import type { RespostaMensagem } from "@arp/shared/os/contratos/base";
import type { Planilha } from "@arp/shared/os/contratos/visoes";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ErroDeValidacao } from "@/erros";
import { lerFormulario } from "@/http/formulario";
import { contextoDe } from "@/http/permissao";
import { disposicao } from "@/infra/arquivos/http";
import * as service from "./ativos.service";
import * as saidas from "./ativos-saidas.service";
import { validar } from "./validar";

// HTTP dos ativos: lê a requisição e chama o service. Os formulários vêm
// validados aqui com o schema do contrato e os rótulos de antes ("Título:
// informe o título"); os com arquivo chegam em multipart.

type ComId = { Params: { id: string } };
type Busca = { Querystring: Record<string, unknown> };

/** Teto do multipart: acima do que a tela aceita (o service responde). */
const LIMITES = { arquivos: 10, bytesPorArquivo: 15 * 1024 * 1024 };

const textoDe = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

export function lista(request: FastifyRequest<Busca>): Promise<RespostaAtivos> {
  return service.lerAtivos(contextoDe(request), request.query);
}

export function exportar(request: FastifyRequest<Busca>): Promise<Planilha> {
  return service.exportarAtivos(contextoDe(request), request.query);
}

export function ficha(request: FastifyRequest<ComId>): Promise<FichaDoAtivo> {
  return service.lerFicha(contextoDe(request), request.params.id);
}

export function opcoes(request: FastifyRequest): Promise<OpcoesDoCadastro> {
  return service.lerOpcoesDoCadastro(contextoDe(request));
}

export function edicao(request: FastifyRequest<ComId>) {
  return service.ativoParaEditar(contextoDe(request), request.params.id);
}

export async function salvar(request: FastifyRequest) {
  const form = await lerFormulario(request, LIMITES);
  const campos = Object.fromEntries(
    Object.entries(form.campos).map(([k, v]) => [k, textoDe(v)]),
  );
  return service.salvarAtivo(
    contextoDe(request),
    campos,
    form.arquivos.find((a) => a.campo === "foto"),
  );
}

export async function situacao(
  request: FastifyRequest<ComId & { Body: unknown }>,
): Promise<RespostaMensagem> {
  service.exigirGerente(contextoDe(request));
  const d = validar(entradaSituacao, request.body, ROTULOS_ATIVO);
  return {
    mensagem: await service.mudarSituacao(
      contextoDe(request),
      request.params.id,
      d.situacao,
    ),
  };
}

export async function baixa(
  request: FastifyRequest<ComId & { Body: unknown }>,
): Promise<RespostaMensagem> {
  service.exigirGerente(contextoDe(request));
  const d = validar(entradaBaixa, request.body, ROTULOS_ATIVO);
  return {
    mensagem: await service.darBaixa(contextoDe(request), request.params.id, d),
  };
}

export async function anexar(
  request: FastifyRequest<ComId>,
): Promise<RespostaMensagem> {
  service.exigirGerente(contextoDe(request));
  const form = await lerFormulario(request, LIMITES);
  const { categoria } = validar(
    entradaAnexoAtivo,
    { categoria: textoDe(form.campos.categoria) },
    ROTULOS_ATIVO,
  );
  return {
    mensagem: await service.enviarAnexo(
      contextoDe(request),
      request.params.id,
      categoria,
      form.arquivos.find((a) => a.campo === "arquivo"),
    ),
  };
}

export async function removerAnexo(
  request: FastifyRequest<ComId>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.removerAnexo(
      contextoDe(request),
      request.params.id,
    ),
  };
}

export async function salvarPlano(
  request: FastifyRequest<{ Body: unknown }>,
): Promise<RespostaMensagem> {
  service.exigirGerente(contextoDe(request));
  const d = validar(entradaPlano, request.body, ROTULOS_ATIVO);
  return { mensagem: await service.salvarPlano(contextoDe(request), d) };
}

export async function alternarPlano(
  request: FastifyRequest<ComId & { Body: unknown }>,
): Promise<RespostaMensagem> {
  service.exigirGerente(contextoDe(request));
  const d = entradaAlternarPlano.safeParse(request.body);
  if (!d.success) throw new ErroDeValidacao("Plano inválido.");
  return {
    mensagem: await service.alternarPlano(
      contextoDe(request),
      request.params.id,
      d.data.ativo,
    ),
  };
}

export async function excluirPlano(
  request: FastifyRequest<ComId>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.excluirPlano(
      contextoDe(request),
      request.params.id,
    ),
  };
}

export async function gerarPreventiva(
  request: FastifyRequest<ComId>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.gerarPreventivaAgora(
      contextoDe(request),
      request.params.id,
    ),
  };
}

export function categorias(request: FastifyRequest) {
  return service.lerCategorias(contextoDe(request));
}

export async function salvarCategoria(
  request: FastifyRequest<{ Body: unknown }>,
): Promise<RespostaMensagem> {
  service.exigirGerente(contextoDe(request));
  const d = validar(entradaCategoriaAtivo, request.body, ROTULOS_ATIVO);
  return { mensagem: await service.salvarCategoria(contextoDe(request), d) };
}

export async function excluirCategoria(
  request: FastifyRequest<ComId>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.excluirCategoria(
      contextoDe(request),
      request.params.id,
    ),
  };
}

export function etiquetas(request: FastifyRequest) {
  return service.lerEtiquetas(contextoDe(request));
}

function enviarPdf(
  reply: FastifyReply,
  pdf: { bytes: Uint8Array; nome: string },
  modo: "inline" | "attachment" = "inline",
) {
  return reply
    .header("content-type", "application/pdf")
    .header("content-disposition", disposicao(modo, pdf.nome))
    .header("cache-control", "private, no-store")
    .send(Buffer.from(pdf.bytes));
}

export async function etiquetasPdf(
  request: FastifyRequest<{
    Querystring: { id: string[]; inicio?: unknown };
  }>,
  reply: FastifyReply,
) {
  const pdf = await service.pdfDeEtiquetas(
    contextoDe(request),
    request.query.id,
    request.query.inicio,
  );
  return enviarPdf(reply, pdf);
}

export async function etiquetasPdfEmLote(
  request: FastifyRequest<{ Body: { ids: string[]; inicio?: unknown } }>,
  reply: FastifyReply,
) {
  const pdf = await service.pdfDeEtiquetas(
    contextoDe(request),
    request.body.ids,
    request.body.inicio,
  );
  return enviarPdf(reply, pdf);
}

// ---------------------------------------------------------------------------
// Saídas
// ---------------------------------------------------------------------------

export function relatorioDeSaidas(
  request: FastifyRequest<Busca>,
): Promise<RespostaSaidas> {
  const busca: Record<string, string | string[] | undefined> = {};
  for (const [k, v] of Object.entries(request.query))
    if (typeof v === "string" || Array.isArray(v))
      busca[k] = Array.isArray(v) ? v.map(String) : v;
  return saidas.lerSaidas(contextoDe(request), busca);
}

export async function recibo(
  request: FastifyRequest<ComId>,
  reply: FastifyReply,
) {
  const pdf = await saidas.reciboDaSaida(
    contextoDe(request),
    request.params.id,
  );
  return enviarPdf(reply, pdf);
}

export async function registrarSaida(request: FastifyRequest) {
  const form = await lerFormulario(request, LIMITES);
  const campos = Object.fromEntries(
    Object.entries(form.campos).map(([k, v]) => [k, textoDe(v)]),
  );
  return saidas.registrarSaida(
    contextoDe(request),
    campos,
    form.arquivos.filter((a) => a.campo === "anexos"),
  );
}

export async function desfazerSaida(
  request: FastifyRequest<ComId & { Body: unknown }>,
): Promise<RespostaMensagem> {
  const d = validar(entradaDesfazerSaida, request.body, { motivo: "Motivo" });
  return {
    mensagem: await saidas.desfazerSaida(
      contextoDe(request),
      request.params.id,
      d.motivo,
    ),
  };
}
