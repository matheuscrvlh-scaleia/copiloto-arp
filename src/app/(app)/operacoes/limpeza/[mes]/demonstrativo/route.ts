import type { NextRequest } from "next/server";
import { formatarDataHora } from "@/lib/formato";
import { lerMes } from "@/lib/operacoes/limpeza";
import { usuarioAtual } from "@/server/auth";
import { mesParaArquivo } from "@/server/operacoes/limpeza";
import { gerarDemonstrativo } from "@/server/operacoes/limpeza-pdf";

// Demonstrativo do rateio em PDF, no papel timbrado: /operacoes/limpeza/
// 2026-09/demonstrativo (todos os locais e a memória) ou ?bloco=01 (o do
// bloco, para o locatário). Quem vê o rateio lê pela sessão; o Financeiro,
// só o mês enviado (mesParaArquivo).
export const maxDuration = 60;

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/operacoes/limpeza/[mes]/demonstrativo">,
) {
  const ref = lerMes((await ctx.params).mes);
  if (!ref) return new Response("Mês inválido.", { status: 400 });
  const lido = await mesParaArquivo(ref);
  if (!lido.ok) return new Response(lido.erro, { status: lido.status });
  const { detalhe, parametros } = lido;
  const pedido = request.nextUrl.searchParams.get("bloco");
  const bloco = pedido && detalhe.blocos.includes(pedido) ? pedido : undefined;
  if (pedido && !bloco)
    return new Response("Bloco fora do rateio deste mês.", { status: 404 });
  const usuario = await usuarioAtual();
  const pdf = await gerarDemonstrativo({
    detalhe,
    empresa: parametros.limpeza_empresa,
    bloco,
    geradoEm: `${formatarDataHora(new Date().toISOString())} por ${usuario.nome}`,
  });
  const nome = `rateio-limpeza-${ref.slice(0, 7)}${bloco ? `-bloco-${bloco}` : ""}.pdf`;
  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nome}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
