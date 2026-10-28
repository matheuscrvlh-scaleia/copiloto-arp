import { osAdmin } from "@/server/os/base";
import { gerarLaudo } from "@/server/os/pdf/laudo";
import { dadosDoLaudo, vistoriaPeloToken } from "@/server/os/vistorias";

// Laudo em PDF pelo link do locatário (sem login): confere o token e lê pela
// service role só a vistoria dele.
export const maxDuration = 120;

export async function GET(
  _: Request,
  ctx: RouteContext<"/vistoria/[token]/laudo">,
) {
  const { token } = await ctx.params;
  const v = await vistoriaPeloToken(token);
  if (!v)
    return new Response("Este link não está mais ativo.", { status: 404 });
  const dados = await dadosDoLaudo(
    v.id,
    { comparar: v.comparar_no_laudo },
    osAdmin(),
  );
  if (!dados) return new Response("Vistoria não encontrada.", { status: 404 });
  const laudo = await gerarLaudo(dados);
  return new Response(laudo.bytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${laudo.nome}"`,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
