import { z } from "zod";
import { podeAgora } from "@/server/auth";
import { linkParaBaixar } from "@/server/marketing/marca";

// Baixar um arquivo de marca (bucket privado "marketing"): confere
// marketing.marca no banco e manda para um link assinado de 60 segundos.
export async function GET(
  _: Request,
  ctx: RouteContext<"/marketing/marca/arquivo/[id]">,
) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success)
    return new Response("Arquivo não encontrado.", { status: 404 });
  if (!(await podeAgora("marketing.marca")))
    return new Response("Você não tem acesso aos arquivos da marca.", {
      status: 403,
    });
  const link = await linkParaBaixar(id);
  if (!link)
    return new Response("Arquivo ainda não enviado ou não encontrado.", {
      status: 404,
    });
  return Response.redirect(link, 302);
}
