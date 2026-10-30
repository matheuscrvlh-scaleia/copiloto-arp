import { timingSafeEqual } from "node:crypto";
import { SyncEmAndamento } from "@/server/sync/execucao";
import { sincronizarMeta } from "@/server/sync/meta";

// Sincronização da Meta (Instagram e Facebook). Chamada pelo Vercel Cron
// (vercel.json), que envia "Authorization: Bearer <CRON_SECRET>". Grava a
// foto de seguidores de hoje e as métricas diárias do Instagram que faltam;
// se o prazo acabar, a próxima continua.
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
    return Response.json(await sincronizarMeta());
  } catch (erro) {
    if (erro instanceof SyncEmAndamento) {
      return Response.json({ erro: erro.message }, { status: 409 });
    }
    console.error("sync meta", erro);
    return Response.json(
      { erro: erro instanceof Error ? erro.message : "falha na sincronização" },
      { status: 500 },
    );
  }
}
