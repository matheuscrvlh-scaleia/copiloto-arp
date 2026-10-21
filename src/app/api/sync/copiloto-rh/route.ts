import { timingSafeEqual } from "node:crypto";
import { sincronizarCopiloto } from "@/server/sync/copiloto-rh";
import { SyncEmAndamento } from "@/server/sync/execucao";

// Sincronização do Copiloto RH. Chamada pelo Vercel Cron (vercel.json), que
// envia "Authorization: Bearer <CRON_SECRET>".
export const maxDuration = 120;

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
    return Response.json(await sincronizarCopiloto());
  } catch (erro) {
    if (erro instanceof SyncEmAndamento) {
      return Response.json({ erro: erro.message }, { status: 409 });
    }
    console.error("sync copiloto rh", erro);
    return Response.json(
      { erro: erro instanceof Error ? erro.message : "falha na sincronização" },
      { status: 500 },
    );
  }
}
