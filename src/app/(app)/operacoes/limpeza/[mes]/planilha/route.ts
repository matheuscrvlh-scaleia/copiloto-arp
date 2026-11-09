import { formatarDataHora } from "@/lib/formato";
import { lerMes } from "@/lib/operacoes/limpeza";
import { podeAgora, usuarioAtual } from "@/server/auth";
import { mesParaArquivo, veRateio } from "@/server/operacoes/limpeza";
import { planilhaDoRateio } from "@/server/operacoes/limpeza-planilha";
import { TIPO_XLSX } from "@/server/os/relatorios/planilha";

// Resultado do rateio por local em Excel (o que vai ao Financeiro). Quem vê
// o rateio precisa também de operacoes.exportar; o Financeiro baixa o mês
// enviado (mesParaArquivo confere).
export const maxDuration = 60;

export async function GET(
  _: Request,
  ctx: RouteContext<"/operacoes/limpeza/[mes]/planilha">,
) {
  const ref = lerMes((await ctx.params).mes);
  if (!ref) return new Response("Mês inválido.", { status: 400 });
  const usuario = await usuarioAtual();
  if (veRateio(usuario.permissoes) && !(await podeAgora("operacoes.exportar")))
    return new Response("Você não tem permissão para exportar.", {
      status: 403,
    });
  const lido = await mesParaArquivo(ref);
  if (!lido.ok) return new Response(lido.erro, { status: lido.status });
  const bytes = await planilhaDoRateio(
    lido.detalhe,
    lido.parametros.limpeza_empresa,
    `${formatarDataHora(new Date().toISOString())} por ${usuario.nome}`,
  );
  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": TIPO_XLSX,
      "Content-Disposition": `attachment; filename="rateio-limpeza-${ref.slice(0, 7)}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
