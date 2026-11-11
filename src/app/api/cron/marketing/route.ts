import { timingSafeEqual } from "node:crypto";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import { aquecerGoogle } from "@/server/marketing/google";
import { aquecerMeta } from "@/server/marketing/meta";

// Aquece o cache das leituras ao vivo do Marketing (Meta e Google), cuja
// chave tem o dia: sem isso, a primeira abertura do Painel no dia espera
// todas as APIs. Chamada pela rotina (deploy/cron/crontab) logo depois da
// meia-noite e antes do expediente, com "Authorization: Bearer <CRON_SECRET>".
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
  const hoje = hojeEmBrasilia(new Date());
  const inicio = Date.now();
  // As leituras devolvem a falha como dado (aviso): aqui não lançam.
  await Promise.all([aquecerMeta(hoje), aquecerGoogle(hoje)]);
  return Response.json({ hoje, ms: Date.now() - inicio });
}
