import { timingSafeEqual } from "node:crypto";
import { IntegracaoNaoConfigurada } from "@/server/integracoes";
import { sincronizarDiarioSeDevido } from "@/server/sync/diario-de-obras";
import { SyncEmAndamento } from "@/server/sync/execucao";

// Consulta ao Diário de Obra. O cron chama a cada 30 min com
// "Authorization: Bearer <CRON_SECRET>"; a rotina só roda quando passou o
// intervalo dos Parâmetros (obras_intervalo_min) ou quando a anterior deixou
// relatórios pendentes. Sem token configurado, não roda (e não é erro).
export const maxDuration = 300;

function autorizado(request: Request): boolean {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  const recebido = Buffer.from(request.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${segredo}`);
  return (
    recebido.length === esperado.length && timingSafeEqual(recebido, esperado)
  );
}

export async function GET(request: Request) {
  if (!autorizado(request)) {
    return Response.json({ erro: "não autorizado" }, { status: 401 });
  }
  try {
    return Response.json(await sincronizarDiarioSeDevido());
  } catch (erro) {
    if (erro instanceof IntegracaoNaoConfigurada) {
      return Response.json({ pulado: erro.message });
    }
    if (erro instanceof SyncEmAndamento) {
      return Response.json({ erro: erro.message }, { status: 409 });
    }
    console.error("sync diário de obra", erro);
    return Response.json(
      { erro: erro instanceof Error ? erro.message : "falha na sincronização" },
      { status: 500 },
    );
  }
}
