import type {
  ConsultaDasIntegracoes,
  EntradaIntegracao,
  ParametrosDoSistema,
  RespostaIntegracaoSalva,
  RespostaIntegracoes,
} from "@arp/shared/admin/contratos";
import type { RespostaMensagem } from "@arp/shared/contratos/auth";
import { AUTORIZACAO_RD_CRM } from "@arp/shared/integracoes";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "@/config/env";
import { contextoDe, origemDe } from "@/http/permissao";
import { COOKIE_RD_CRM } from "./autorizacao-rd-crm";
import * as service from "./integracoes.service";

type DoSistema = { Params: ParametrosDoSistema };

export async function listar(
  request: FastifyRequest<{ Querystring: ConsultaDasIntegracoes }>,
): Promise<RespostaIntegracoes> {
  return service.integracoesNaTela(contextoDe(request), request.query);
}

export async function salvar(
  request: FastifyRequest<DoSistema & { Body: EntradaIntegracao }>,
  reply: FastifyReply,
): Promise<RespostaIntegracaoSalva> {
  const { mensagem, autorizacao } = await service.salvarIntegracao(
    contextoDe(request),
    request.params.sistema,
    request.body,
  );
  if (!autorizacao) return { mensagem };
  // O state da autorização: só volta para a rota de retorno, e precisa
  // chegar vindo do site da ferramenta (por isso Lax, não Strict).
  const { cookie } = autorizacao;
  reply.setCookie(cookie.nome, cookie.valor, {
    httpOnly: true,
    secure: env.COOKIES_SEGUROS,
    sameSite: "lax",
    path: cookie.caminho,
    maxAge: cookie.segundos,
  });
  return { mensagem, redirecionar: autorizacao.url };
}

export async function testar(
  request: FastifyRequest<DoSistema>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.testarIntegracao(
      contextoDe(request),
      request.params.sistema,
    ),
  };
}

export async function sincronizar(
  request: FastifyRequest<DoSistema>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.sincronizarAgora(
      contextoDe(request),
      request.params.sistema,
    ),
  };
}

export async function remover(
  request: FastifyRequest<DoSistema>,
): Promise<RespostaMensagem> {
  await service.removerIntegracao(contextoDe(request), request.params.sistema);
  return { mensagem: "Credencial removida." };
}

/**
 * Volta da autorização do RD Station CRM (URL de callback do app do CRM).
 * Conclui, começa a primeira leitura das oportunidades e leva ao cartão.
 */
export async function retornoRdCrm(
  request: FastifyRequest<{ Querystring: { code?: string; state?: string } }>,
  reply: FastifyReply,
) {
  const r = await service.concluirAutorizacaoRdCrm(
    request.cookies[COOKIE_RD_CRM],
    request.query.code ?? "",
    request.query.state ?? "",
    origemDe(request),
  );
  reply.clearCookie(COOKIE_RD_CRM, { path: AUTORIZACAO_RD_CRM.retorno });
  const destino = new URL("/admin/integracoes", env.SITE_URL);
  destino.search = new URLSearchParams({ rdcrm: r }).toString();
  destino.hash = "rd_crm";
  return reply.redirect(destino.toString());
}
