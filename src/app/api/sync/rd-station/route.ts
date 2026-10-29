import { timingSafeEqual } from "node:crypto";
import { SyncEmAndamento } from "@/server/sync/execucao";
import { sincronizarRd } from "@/server/sync/rd-station";

// Sincronização do RD Station Marketing. Chamada pelo Vercel Cron
// (vercel.json), que envia "Authorization: Bearer <CRON_SECRET>". Lê as
// landing pages dos dias que faltam e os leads que converteram desde a
// última vez; se o prazo acabar, a próxima continua.
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
    return Response.json(await sincronizarRd());
  } catch (erro) {
    if (erro instanceof SyncEmAndamento) {
      return Response.json({ erro: erro.message }, { status: 409 });
    }
    console.error("sync rd station", erro);
    return Response.json(
      { erro: erro instanceof Error ? erro.message : "falha na sincronização" },
      { status: 500 },
    );
  }
}
