import { Readable } from "node:stream";
import type { RespostaMensagem } from "@arp/shared/contratos/auth";
import type { FastifyReply, FastifyRequest } from "fastify";
import {
  ErroDaApi,
  ErroDeConflito,
  ErroDePermissao,
  ErroDeValidacao,
  ErroNaoEncontrado,
} from "@/erros";
import { noDisco } from "@/infra/arquivos";
import { conferir } from "@/infra/arquivos/assinatura";
import { nomeDoCaminho } from "@/infra/arquivos/caminho";
import { ArquivoGrandeDemais, ArquivoJaExiste } from "@/infra/arquivos/disco";
import {
  disposicao,
  lerFaixa,
  podeMostrar,
  tipoLimpo,
} from "@/infra/arquivos/http";

// /api/v1/arquivos/<token>: GET entrega o arquivo, PUT recebe o envio do
// navegador. Não olha a sessão: vale o token assinado, que só é gerado
// depois de conferida a permissão (e é o que abre a foto no link público da
// OS ou o laudo enviado pelo WhatsApp).

type Pedido = FastifyRequest<{ Params: { token: string } }>;

const LINK_INVALIDO = "Link inválido ou vencido.";
const grandeDemais = () =>
  new ErroDaApi("validacao", 413, "Arquivo grande demais.");

export async function ler(request: Pedido, reply: FastifyReply) {
  const p = conferir(request.params.token);
  if (!p || p.op !== "ler") throw new ErroDePermissao(LINK_INVALIDO);
  const disco = noDisco();
  const info = await disco.info(p.bucket, p.caminho);
  if (!info) throw new ErroNaoEncontrado("Arquivo não encontrado.");

  const tipo = tipoLimpo(info.tipo);
  const mostrar = !p.baixarComo && podeMostrar(tipo);
  const restante = p.exp - Math.floor(Date.now() / 1000);
  reply.headers({
    "content-type": tipo,
    "content-disposition": mostrar
      ? "inline"
      : disposicao("attachment", p.baixarComo ?? nomeDoCaminho(p.caminho)),
    "x-content-type-options": "nosniff",
    "accept-ranges": "bytes",
    "cache-control": `private, max-age=${Math.max(0, Math.min(3600, restante))}`,
    // O conteúdo foi enviado por alguém: nunca roda script nem carrega nada
    // de fora, mesmo aberto direto na aba.
    "content-security-policy":
      "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
  });
  // O leitor de PDF do Chrome não abre com "sandbox"; o resto fica isolado.
  if (tipo === "application/pdf") reply.removeHeader("content-security-policy");

  const faixa = lerFaixa(request.headers.range ?? null, info.tamanho);
  if (faixa === "invalida")
    return reply
      .code(416)
      .header("content-range", `bytes */${info.tamanho}`)
      .send();
  if (faixa) {
    reply.code(206).headers({
      "content-range": `bytes ${faixa.inicio}-${faixa.fim}/${info.tamanho}`,
      "content-length": faixa.fim - faixa.inicio + 1,
    });
  } else reply.header("content-length", info.tamanho);
  return reply.send(disco.abrir(p.bucket, p.caminho, faixa ?? undefined));
}

export async function enviar(request: Pedido): Promise<RespostaMensagem> {
  const p = conferir(request.params.token);
  if (!p || p.op !== "enviar") throw new ErroDePermissao(LINK_INVALIDO);
  const declarado = Number(request.headers["content-length"]);
  if (Number.isFinite(declarado) && declarado > p.maxBytes)
    throw grandeDemais();
  const tipo = tipoLimpo(request.headers["content-type"]);
  if (tipo.startsWith("multipart/"))
    throw new ErroDaApi(
      "validacao",
      415,
      "Envie o arquivo direto no corpo, sem formulário.",
    );
  // O corpo chega como fluxo (ver o parser em ./index.ts): vai direto para
  // o disco, sem passar pela memória.
  if (!(request.body instanceof Readable))
    throw new ErroDeValidacao("Arquivo vazio.");
  try {
    await noDisco().gravar(p.bucket, p.caminho, request.body, {
      tipo,
      maxBytes: p.maxBytes,
    });
  } catch (e) {
    if (e instanceof ArquivoJaExiste)
      throw new ErroDeConflito("Este arquivo já foi enviado.");
    if (e instanceof ArquivoGrandeDemais) throw grandeDemais();
    throw e;
  }
  return { mensagem: "Arquivo recebido." };
}
