import { timingSafeEqual } from "node:crypto";
import { rodarRotinas } from "@/server/os/rotinas";

// Rotinas do módulo Chamados e OS, de hora em hora. Chamada pelo Vercel Cron
// (vercel.json), que envia "Authorization: Bearer <CRON_SECRET>". Aceite
// automático, avisos de prazo, lembretes recorrentes, modelos de entrada e
// saída, planos preventivos e cobrança do terceirizado.
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
  const resultados = await rodarRotinas(new Date());
  const falhou = resultados.some((r) => !r.ok);
  // 500 quando alguma falhou: o painel do Vercel mostra a execução em erro.
  return Response.json({ resultados }, { status: falhou ? 500 : 200 });
}
