import { timingSafeEqual } from "node:crypto";
import { rodarRotinasComercial } from "@/server/comercial/rotinas";

// Lembretes do módulo Comercial, uma vez por dia. Chamada pelo Vercel Cron
// (vercel.json), que envia "Authorization: Bearer <CRON_SECRET>":
// aniversários de contrato e de sócio e documentos do kit vencendo.
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
  const resultados = await rodarRotinasComercial(new Date());
  const falhou = resultados.some((r) => !r.ok);
  return Response.json({ resultados }, { status: falhou ? 500 : 200 });
}
