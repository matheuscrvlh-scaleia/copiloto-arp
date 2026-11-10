import { type NextRequest, NextResponse } from "next/server";
import { origem } from "@/server/marketing/autorizacao-rd";
import { concluirAutorizacaoTikTok } from "@/server/marketing/autorizacao-tiktok";

// Volta da autorização do anunciante no TikTok (URL de retorno cadastrada no
// app). Conclui e leva de volta ao cartão do TikTok.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const r = await concluirAutorizacaoTikTok(
    q.get("auth_code") ?? q.get("code") ?? "",
    q.get("state") ?? "",
  );
  // Atrás do nginx, request.nextUrl traz o endereço interno (0.0.0.0:3000).
  const destino = new URL(await origem());
  destino.pathname = "/marketing/configuracoes/integracoes";
  destino.search = new URLSearchParams({ tiktok: r }).toString();
  destino.hash = "mkt_tiktok";
  return NextResponse.redirect(destino);
}
