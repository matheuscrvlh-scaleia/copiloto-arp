import { after, type NextRequest, NextResponse } from "next/server";
import { concluirAutorizacaoRdCrm } from "@/server/admin/autorizacao-rd-crm";
import { sincronizarRdCrm } from "@/server/sync/rd-crm";

// Volta da autorização do RD Station CRM (URL de callback do app do CRM).
// Conclui, começa a primeira leitura das oportunidades e leva ao cartão.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const r = await concluirAutorizacaoRdCrm(
    q.get("code") ?? "",
    q.get("state") ?? "",
  );
  if (r === "conectado")
    after(async () => {
      try {
        await sincronizarRdCrm();
      } catch (erro) {
        // O erro fica registrado em integracao.sync_runs.
        console.error("sync rd crm (conexão)", erro);
      }
    });
  const destino = request.nextUrl.clone();
  destino.pathname = "/admin/integracoes";
  destino.search = new URLSearchParams({ rdcrm: r }).toString();
  destino.hash = "rd_crm";
  return NextResponse.redirect(destino);
}
