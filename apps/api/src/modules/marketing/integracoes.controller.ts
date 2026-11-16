import {
  AUTORIZACAO_GOOGLE,
  AUTORIZACAO_RD,
  AUTORIZACAO_TIKTOK,
  type SistemaGoogle,
} from "@arp/shared/integracoes";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "@/config/env";
import { ErroDePermissao } from "@/erros";
import { contextoDe } from "@/http/permissao";
import { podeConfigurar } from "@/modules/sync/credenciais.service";
import {
  COOKIES_DE_AUTORIZACAO as COOKIE,
  concluirAutorizacaoGoogle,
  concluirAutorizacaoRd,
  concluirAutorizacaoTikTok,
} from "./autorizacao";
import { descobertasDaTela } from "./descoberta-google";

// HTTP das integrações do Marketing: as listas do Google e a volta das
// autorizações (que leva a pessoa de volta ao cartão do acesso).

/** Só quem configura o acesso (marketing.parametros ou admin.integracoes). */
export async function descobertas(
  request: FastifyRequest<{ Params: { sistema: SistemaGoogle } }>,
) {
  const ctx = contextoDe(request);
  if (!(await podeConfigurar(ctx, request.params.sistema)))
    throw new ErroDePermissao();
  return {
    descobertas: await descobertasDaTela(ctx, request.params.sistema),
  };
}

type Volta = FastifyRequest<{
  Querystring: {
    code?: string;
    state?: string;
    error?: string;
    auth_code?: string;
  };
}>;

function levarPara(
  reply: FastifyReply,
  caminho: string,
  busca: Record<string, string>,
  ancora: string,
) {
  const destino = new URL(caminho, env.SITE_URL);
  destino.search = new URLSearchParams(busca).toString();
  destino.hash = ancora;
  return reply.redirect(destino.toString());
}

/** Volta do Google e do YouTube (URL cadastrada no app do Google Cloud). */
export async function retornoGoogle(request: Volta, reply: FastifyReply) {
  const { sistema, resultado } = await concluirAutorizacaoGoogle(
    request.cookies[COOKIE.google],
    {
      code: request.query.code ?? "",
      state: request.query.state ?? "",
      erro: request.query.error ?? "",
    },
  );
  reply.clearCookie(COOKIE.google, { path: AUTORIZACAO_GOOGLE.retorno });
  return levarPara(
    reply,
    "/marketing/configuracoes/integracoes",
    { google: resultado, sistema },
    sistema,
  );
}

/** Volta do RD Station (a tela repassa o que chega na raiz do sistema). */
export async function retornoRd(request: Volta, reply: FastifyReply) {
  const r = await concluirAutorizacaoRd(
    request.cookies[COOKIE.rd],
    request.query.code ?? "",
    request.query.state ?? "",
  );
  reply.clearCookie(COOKIE.rd, { path: AUTORIZACAO_RD.retorno });
  return levarPara(reply, "/admin/integracoes", { rd: r }, "mkt_rd_station");
}

/** Volta do anunciante no TikTok (URL de retorno cadastrada no app). */
export async function retornoTikTok(request: Volta, reply: FastifyReply) {
  const r = await concluirAutorizacaoTikTok(
    request.cookies[COOKIE.tiktok],
    request.query.auth_code ?? request.query.code ?? "",
    request.query.state ?? "",
  );
  reply.clearCookie(COOKIE.tiktok, { path: AUTORIZACAO_TIKTOK.retorno });
  return levarPara(
    reply,
    "/marketing/configuracoes/integracoes",
    { tiktok: r },
    "mkt_tiktok",
  );
}
