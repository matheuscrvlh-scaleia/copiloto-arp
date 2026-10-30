import { type NextRequest, NextResponse } from "next/server";
import { concluirAutorizacaoGoogle } from "@/server/marketing/autorizacao-google";

// Volta da autorização do Google (URL cadastrada no app do Google Cloud).
// Conclui e leva de volta ao cartão do Google.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const r = await concluirAutorizacaoGoogle({
    code: q.get("code") ?? "",
    state: q.get("state") ?? "",
    erro: q.get("error") ?? "",
  });
  const destino = request.nextUrl.clone();
  destino.pathname = "/marketing/configuracoes/integracoes";
  destino.search = new URLSearchParams({ google: r }).toString();
  destino.hash = "mkt_google";
  return NextResponse.redirect(destino);
}
