import { type NextRequest, NextResponse } from "next/server";
import { concluirAutorizacaoGoogle } from "@/server/marketing/autorizacao-google";

// Volta da autorização do Google (URL cadastrada no app do Google Cloud),
// para o Google e para o YouTube. Conclui e leva de volta ao cartão do
// acesso que começou.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const { sistema, resultado } = await concluirAutorizacaoGoogle({
    code: q.get("code") ?? "",
    state: q.get("state") ?? "",
    erro: q.get("error") ?? "",
  });
  const destino = request.nextUrl.clone();
  destino.pathname = "/marketing/configuracoes/integracoes";
  destino.search = new URLSearchParams({
    google: resultado,
    sistema,
  }).toString();
  destino.hash = sistema;
  return NextResponse.redirect(destino);
}
