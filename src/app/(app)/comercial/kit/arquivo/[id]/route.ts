import { z } from "zod";
import { linkDaVersao } from "@/server/comercial/kit";

// Baixar uma versão de documento do kit (bucket privado "comercial"): o RLS
// confere kit.ver ou contratos ao ler a versão; depois, link assinado de 60 s.
export async function GET(
  _: Request,
  ctx: RouteContext<"/comercial/kit/arquivo/[id]">,
) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success)
    return new Response("Documento não encontrado.", { status: 404 });
  const link = await linkDaVersao(id);
  if (!link)
    return new Response(
      "Este documento ainda não tem arquivo (ou você não tem acesso a ele). Suba o PDF na tela do Kit de entrega.",
      {
        status: 404,
      },
    );
  return Response.redirect(link, 302);
}
