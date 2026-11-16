import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { TAG } from "@/server/cache";
import { rodarRotinasSustentabilidade } from "@/server/sustentabilidade/rotinas";

// Rotinas do Módulo Sustentabilidade, uma vez por dia (cron do contêiner,
// deploy/cron/crontab; antes o Vercel Cron), com "Authorization: Bearer
// <CRON_SECRET>": cópia dos contratos de os.lojas e chamados das
// entrevistas. A lista das rotinas fica em server/sustentabilidade/rotinas.ts.
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
  const resultados = await rodarRotinasSustentabilidade(new Date());
  revalidateTag(TAG.sustentabilidade.contratos, { expire: 0 });
  const falhou = resultados.some((r) => !r.ok);
  // 500 quando alguma falhou: aparece como execução em erro no log do cron.
  return Response.json({ resultados }, { status: falhou ? 500 : 200 });
}
