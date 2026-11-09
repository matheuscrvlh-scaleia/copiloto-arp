import { z } from "zod";
import { empresa } from "@/server/admin/dados";
import { contexto } from "@/server/os/base";
import { gerarReciboDeSaida } from "@/server/os/pdf/recibo-saida";
import { saidaParaRecibo } from "@/server/os/saidas";

// Recibo (ou termo de doação) da saída do ativo, no papel timbrado. A saída
// vem pelo RLS (quem vê ativos ou registra saídas).
export async function GET(
  _: Request,
  ctx: RouteContext<"/os/ativos/saidas/[id]/recibo">,
) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success)
    return new Response("Saída não encontrada.", { status: 404 });
  const c = await contexto();
  if (
    !c.pode("os.ativos") &&
    !c.pode("os.ativos_gerenciar") &&
    !c.pode("os.ativos_saida")
  )
    return new Response("Você não tem acesso às saídas de ativos.", {
      status: 403,
    });
  const [saida, dadosDaEmpresa] = await Promise.all([
    saidaParaRecibo(id),
    empresa(),
  ]);
  if (!saida) return new Response("Saída não encontrada.", { status: 404 });
  const pdf = await gerarReciboDeSaida(saida, dadosDaEmpresa);
  // O código é editável: no cabeçalho, só ASCII seguro.
  const codigo = (saida.ativo?.codigo ?? "ativo").replace(
    /[^A-Za-z0-9._-]+/g,
    "-",
  );
  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="recibo-saida-${codigo}-${saida.data}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
