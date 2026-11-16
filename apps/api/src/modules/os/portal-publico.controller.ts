import type { RespostaMensagem } from "@arp/shared/os/contratos/base";
import {
  type EntradaEntrar,
  type entradaAvaliacao,
  entradaPedido,
  type entradaReabertura,
  type entradaRemarcacao,
  entradaResposta,
  type QuemPede,
  quemPede,
  type RespostaEntrar,
  type RespostaInicioDoPortal,
  type RespostaNovoPedido,
  type RespostaPedidoCriado,
  type RespostaPedidoDoPortal,
} from "@arp/shared/os/contratos/portal";
import { LIMITES_PORTAL } from "@arp/shared/os/portal";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { z } from "zod";
import { ErroDeNegocio } from "@/erros";
import { type Formulario, lerFormulario } from "@/http/formulario";
import { origemDe } from "@/http/permissao";
import { UUID } from "./alvo";
import {
  gravarCookieDoPortal,
  limparCookieDoPortal,
  tokenDoPedido,
} from "./portal-cookie";
import * as pedidos from "./portal-pedidos.service";
import * as service from "./portal-publico.service";

// HTTP do portal do lojista (rotas públicas). A sessão é a do cookie do
// portal, nunca a dos usuários do sistema: o controller só lê o token do
// cookie (já com a assinatura conferida) e repassa; quem confere a sessão no
// banco é o service, em toda chamada.

type ComId = { Params: { id: string } };

export function inicio(
  request: FastifyRequest,
): Promise<RespostaInicioDoPortal> {
  return service.inicio(tokenDoPedido(request));
}

export function novoPedido(
  request: FastifyRequest<ComId>,
): Promise<RespostaNovoPedido> {
  return service.novoPedido(tokenDoPedido(request), request.params.id);
}

export function pedido(
  request: FastifyRequest<ComId>,
): Promise<RespostaPedidoDoPortal> {
  return service.pedido(tokenDoPedido(request), request.params.id);
}

export async function entrar(
  request: FastifyRequest<{ Body: EntradaEntrar }>,
  reply: FastifyReply,
): Promise<RespostaEntrar> {
  const r = await service.entrar(origemDe(request), request.body);
  if (!r.entrou) return { entrou: false, lojas: r.lojas };
  gravarCookieDoPortal(reply, r.token, r.expira);
  return { entrou: true };
}

export async function sair(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<RespostaMensagem> {
  await service.sair(tokenDoPedido(request));
  limparCookieDoPortal(reply);
  return { mensagem: "Você saiu do portal." };
}

// ---------------------------------------------------------------------------
// Gravações do lojista
// ---------------------------------------------------------------------------

const um = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

/** Valida com a primeira mensagem do schema, como a ação de antes. */
function conferir<S extends z.ZodType>(
  esquema: S,
  dados: unknown,
  padrao: string,
): z.output<S> {
  const d = esquema.safeParse(dados);
  if (!d.success) throw new ErroDeNegocio(d.error.issues[0]?.message ?? padrao);
  return d.data;
}

/**
 * Formulário com arquivos. A sessão é conferida ANTES de ler o corpo: quem
 * não está dentro do portal não faz o servidor receber arquivo.
 */
async function formularioDoLojista(
  request: FastifyRequest,
): Promise<{ form: Formulario; quem: QuemPede }> {
  await service.conferirSessao(tokenDoPedido(request));
  const form = await lerFormulario(request, {
    arquivos: LIMITES_PORTAL.arquivosPorEnvio,
    bytesPorArquivo: LIMITES_PORTAL.tamanhoArquivo,
  });
  const quem = conferir(
    quemPede,
    { nome: um(form.campos.nome), telefone: um(form.campos.telefone) },
    "Confira os dados.",
  );
  return { form, quem };
}

function idDoPedido(request: FastifyRequest<ComId>): string {
  if (!UUID.test(request.params.id))
    throw new ErroDeNegocio("Pedido não encontrado.");
  return request.params.id;
}

export async function enviarPedido(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<RespostaPedidoCriado> {
  const { form, quem } = await formularioDoLojista(request);
  const d = conferir(
    entradaPedido,
    {
      categoria: um(form.campos.categoria),
      descricao: um(form.campos.descricao),
      horario: um(form.campos.horario),
    },
    "Confira o pedido.",
  );
  const valores: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(form.campos))
    if (chave.startsWith("campo_"))
      valores[chave.slice("campo_".length)] = um(valor);

  const r = await pedidos.criarPedido(tokenDoPedido(request), {
    categoriaId: d.categoria,
    solicitante: quem,
    descricao: d.descricao,
    horario: d.horario ? new Date(d.horario) : null,
    valores,
    arquivos: pedidos.arquivosDoFormulario(form.arquivos),
  });
  reply.code(201);
  return { mensagem: "Pedido enviado.", ...r };
}

export async function responder(
  request: FastifyRequest<ComId>,
): Promise<RespostaMensagem> {
  const pedidoId = idDoPedido(request);
  const { form, quem } = await formularioDoLojista(request);
  const d = conferir(
    entradaResposta,
    { texto: um(form.campos.texto) },
    "Confira a mensagem.",
  );
  const r = await pedidos.responderPedido(tokenDoPedido(request), {
    pedidoId,
    solicitante: quem,
    texto: d.texto,
    arquivos: pedidos.arquivosDoFormulario(form.arquivos),
  });
  return { mensagem: r.aviso ?? "Mensagem enviada." };
}

type Corpo<S extends z.ZodType> = ComId & { Body: QuemPede & z.output<S> };

const solicitante = (b: QuemPede): QuemPede => ({
  nome: b.nome,
  telefone: b.telefone,
});

export async function avaliar(
  request: FastifyRequest<Corpo<typeof entradaAvaliacao>>,
): Promise<RespostaMensagem> {
  await pedidos.avaliarPedido(tokenDoPedido(request), {
    pedidoId: idDoPedido(request),
    solicitante: solicitante(request.body),
    nota: request.body.nota,
    comentario: request.body.comentario,
  });
  return { mensagem: "Obrigado pela avaliação!" };
}

export async function reabrir(
  request: FastifyRequest<Corpo<typeof entradaReabertura>>,
): Promise<RespostaMensagem> {
  await pedidos.reabrirPedido(tokenDoPedido(request), {
    pedidoId: idDoPedido(request),
    solicitante: solicitante(request.body),
    motivo: request.body.motivo,
  });
  return { mensagem: "Pedido reaberto. A equipe foi avisada." };
}

export async function remarcar(
  request: FastifyRequest<Corpo<typeof entradaRemarcacao>>,
): Promise<RespostaMensagem> {
  await pedidos.remarcarPeloPortal(tokenDoPedido(request), {
    pedidoId: idDoPedido(request),
    agendamentoId: request.body.agendamento,
    solicitante: solicitante(request.body),
    inicio: new Date(request.body.horario),
  });
  return { mensagem: "Horário remarcado." };
}
