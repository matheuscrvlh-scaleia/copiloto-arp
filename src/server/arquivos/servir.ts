import "server-only";
import { Readable } from "node:stream";
import { conferir } from "./assinatura";
import { nomeDoCaminho } from "./caminho";
import { noDisco } from "./config";
import { ArquivoGrandeDemais, ArquivoJaExiste } from "./disco";
import { disposicao, lerFaixa, podeMostrar, tipoLimpo } from "./http";

// A rota /api/arquivos/<token>: GET entrega o arquivo, PUT recebe o envio
// do navegador. Não olha sessão: vale o token assinado, que só é gerado
// depois de conferida a permissão (e é o que abre a foto no link público
// da OS ou o laudo enviado pelo WhatsApp).

function aviso(status: number, texto: string): Response {
  return new Response(texto, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function responderLeitura(
  token: string,
  request: Request,
): Promise<Response> {
  const p = conferir(token);
  if (!p || p.op !== "ler") return aviso(403, "Link inválido ou vencido.");
  const d = noDisco();
  const info = await d.info(p.bucket, p.caminho);
  if (!info) return aviso(404, "Arquivo não encontrado.");

  const tipo = tipoLimpo(info.tipo);
  const mostrar = !p.baixarComo && podeMostrar(tipo);
  const restante = p.exp - Math.floor(Date.now() / 1000);
  const headers = new Headers({
    "Content-Type": tipo,
    "Content-Disposition": mostrar
      ? "inline"
      : disposicao("attachment", p.baixarComo ?? nomeDoCaminho(p.caminho)),
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
    "Cache-Control": `private, max-age=${Math.max(0, Math.min(3600, restante))}`,
  });
  // O leitor de PDF do Chrome não abre com "sandbox"; o resto fica isolado.
  if (tipo !== "application/pdf")
    headers.set(
      "Content-Security-Policy",
      "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
    );

  const faixa = lerFaixa(request.headers.get("range"), info.tamanho);
  if (faixa === "invalida")
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${info.tamanho}` },
    });
  if (faixa) {
    headers.set(
      "Content-Range",
      `bytes ${faixa.inicio}-${faixa.fim}/${info.tamanho}`,
    );
    headers.set("Content-Length", String(faixa.fim - faixa.inicio + 1));
  } else headers.set("Content-Length", String(info.tamanho));
  const corpo = Readable.toWeb(
    d.abrir(p.bucket, p.caminho, faixa ?? undefined),
  ) as ReadableStream<Uint8Array>;
  return new Response(corpo, { status: faixa ? 206 : 200, headers });
}

export async function responderEnvio(
  token: string,
  request: Request,
): Promise<Response> {
  const p = conferir(token);
  if (!p || p.op !== "enviar") return aviso(403, "Link inválido ou vencido.");
  const d = noDisco();
  const declarado = Number(request.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > p.maxBytes)
    return aviso(413, "Arquivo grande demais.");
  const tipo = tipoLimpo(request.headers.get("content-type"));
  if (tipo.startsWith("multipart/"))
    return aviso(415, "Envie o arquivo direto no corpo, sem formulário.");
  if (!request.body) return aviso(400, "Arquivo vazio.");
  try {
    await d.gravar(p.bucket, p.caminho, request.body, {
      tipo,
      maxBytes: p.maxBytes,
    });
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    if (e instanceof ArquivoJaExiste)
      return aviso(409, "Este arquivo já foi enviado.");
    if (e instanceof ArquivoGrandeDemais)
      return aviso(413, "Arquivo grande demais.");
    console.error("envio de arquivo", p.bucket, p.caminho, e);
    return aviso(500, "Não foi possível guardar o arquivo.");
  }
}
