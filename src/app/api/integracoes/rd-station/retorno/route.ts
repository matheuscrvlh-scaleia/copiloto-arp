import { type NextRequest, NextResponse } from "next/server";
import { concluirAutorizacaoRd } from "@/server/marketing/autorizacao-rd";

// Volta da autorização do RD Station (o proxy repassa o code e o state que
// chegam na raiz do sistema). Conclui e leva de volta ao cartão do RD.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const r = await concluirAutorizacaoRd(
    q.get("code") ?? "",
    q.get("state") ?? "",
  );
  const destino = request.nextUrl.clone();
  destino.pathname = "/marketing/configuracoes/integracoes";
  destino.search = new URLSearchParams({ rd: r }).toString();
  destino.hash = "mkt_rd_station";
  return NextResponse.redirect(destino);
}
