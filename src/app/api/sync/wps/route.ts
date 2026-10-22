import { timingSafeEqual } from "node:crypto";
import { SyncEmAndamento } from "@/server/sync/execucao";
import { sincronizarWps } from "@/server/sync/wps";
import { diasDoIntervalo } from "@/server/sync/wps-regras";

// Sincronização do estacionamento (WPS). Chamada pelo Vercel Cron
// (vercel.json), que envia "Authorization: Bearer <CRON_SECRET>". Sem
// parâmetros, relê a última semana. Reprocessar um período:
// GET /api/sync/wps?de=2026-09-01&ate=2026-09-30
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

  const params = new URL(request.url).searchParams;
  const de = params.get("de");
  let dias: string[] | undefined;
  try {
    dias = de ? diasDoIntervalo(de, params.get("ate") ?? de) : undefined;
  } catch (erro) {
    return Response.json({ erro: (erro as Error).message }, { status: 400 });
  }

  try {
    return Response.json(await sincronizarWps({ dias }));
  } catch (erro) {
    if (erro instanceof SyncEmAndamento) {
      return Response.json({ erro: erro.message }, { status: 409 });
    }
    console.error("sync wps", erro);
    return Response.json(
      { erro: erro instanceof Error ? erro.message : "falha na sincronização" },
      { status: 500 },
    );
  }
}
