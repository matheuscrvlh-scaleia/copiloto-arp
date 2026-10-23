import type { NextRequest } from "next/server";
import { z } from "zod";
import { contexto } from "@/server/os/base";
import { gerarLaudo } from "@/server/os/pdf/laudo";
import { dadosDoLaudo } from "@/server/os/vistorias";

// Laudo da vistoria em PDF (4.16 B). Confere a permissão pela sessão e lê a
// vistoria pelo RLS. ?entrada=1 põe as fotos da entrada na saída;
// ?baixar=1 baixa o arquivo em vez de abrir no navegador.
export const maxDuration = 120;

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/os/vistorias/[id]/laudo">,
) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success)
    return new Response("Vistoria não encontrada.", { status: 404 });
  const { pode } = await contexto();
  if (!pode("os.vistorias"))
    return new Response("Você não tem acesso às vistorias.", { status: 403 });

  const busca = request.nextUrl.searchParams;
  const dados = await dadosDoLaudo(id, {
    comparar: busca.get("entrada") === "1",
  });
  if (!dados) return new Response("Vistoria não encontrada.", { status: 404 });

  const laudo = await gerarLaudo(dados);
  const modo = busca.get("baixar") === "1" ? "attachment" : "inline";
  return new Response(laudo.bytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${modo}; filename="${laudo.nome}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
