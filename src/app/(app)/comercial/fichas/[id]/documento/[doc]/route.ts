import { pode, usuarioAtual } from "@/server/auth";
import { enderecoDoDocumento } from "@/server/comercial/fichas";

// Documento comprobatório da ficha: confere comercial.formulario.ver, lê a
// linha pelo RLS, registra o acesso e manda para um endereço assinado de
// poucos minutos no bucket privado.
export async function GET(
  _: Request,
  ctx: RouteContext<"/comercial/fichas/[id]/documento/[doc]">,
) {
  const { id, doc } = await ctx.params;
  if (!(await pode("comercial.formulario.ver")))
    return new Response("Você não tem acesso às fichas cadastrais.", {
      status: 403,
    });
  const usuario = await usuarioAtual();
  const r = await enderecoDoDocumento(id, doc, usuario.id);
  if (r === "nao_existe")
    return new Response("Documento não encontrado.", { status: 404 });
  if (r === "sem_arquivo")
    return new Response(
      "O arquivo não está no armazenamento (ficha de exemplo do mockup ou arquivo removido).",
      { status: 404 },
    );
  return Response.redirect(r, 302);
}
