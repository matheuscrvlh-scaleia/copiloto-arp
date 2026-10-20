import { timingSafeEqual } from "node:crypto";
import { SyncEmAndamento } from "@/server/sync/execucao";
import { sincronizarSecullum } from "@/server/sync/secullum";
import { competenciaDoMes } from "@/server/sync/secullum-regras";

// Sincronização do ponto. Chamada pelo Vercel Cron (vercel.json), que envia
// "Authorization: Bearer <CRON_SECRET>". Reprocessar um mês:
// GET /api/sync/secullum?competencia=2026-09
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

  const meses = new URL(request.url).searchParams.getAll("competencia");
  let competencias: ReturnType<typeof competenciaDoMes>[] | undefined;
  try {
    competencias = meses.length
      ? meses.map((m) => competenciaDoMes(m))
      : undefined;
  } catch (erro) {
    return Response.json({ erro: (erro as Error).message }, { status: 400 });
  }

  try {
    const resultado = await sincronizarSecullum({ competencias });
    return Response.json(resultado);
  } catch (erro) {
    if (erro instanceof SyncEmAndamento) {
      return Response.json({ erro: erro.message }, { status: 409 });
    }
    console.error("sync secullum", erro);
    return Response.json(
      { erro: erro instanceof Error ? erro.message : "falha na sincronização" },
      { status: 500 },
    );
  }
}
