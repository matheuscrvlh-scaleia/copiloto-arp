import { z } from "zod";
import { contextoCom, parametros } from "@/server/comercial/base";
import { propostaEvento } from "@/server/comercial/eventos";
import { gerarPdfProposta } from "@/server/comercial/eventos-pdf";

// PDF da proposta de evento (eventos.ver; a proposta vem pelo RLS).
export async function GET(
  _: Request,
  ctx: RouteContext<"/comercial/eventos/proposta/[id]/pdf">,
) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success)
    return new Response("Proposta não encontrada.", { status: 404 });
  const c = await contextoCom();
  if (!c.pode("comercial.eventos.ver") && !c.pode("comercial.eventos.editar"))
    return new Response("Você não tem acesso às propostas de evento.", {
      status: 403,
    });
  const [p, param] = await Promise.all([propostaEvento(id), parametros()]);
  if (!p) return new Response("Proposta não encontrada.", { status: 404 });
  const pdf = await gerarPdfProposta(p, param);
  const nome = p.cliente
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 60);
  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="proposta-evento-${nome || "cliente"}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
