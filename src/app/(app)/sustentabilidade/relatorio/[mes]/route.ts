import { formatarData, formatarDataHora } from "@/lib/formato";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import {
  NOMES_DOS_MESES,
  periodoEscrito,
} from "@/lib/sustentabilidade/painel-indicadores";
import { podeAgora, usuarioAtual } from "@/server/auth";
import {
  chamadoAbertoDaOrigem,
  concluirPeloSistema,
} from "@/server/os/sistema";
import { dadosDoPainel } from "@/server/sustentabilidade/painel";
import { gerarRelatorioDoMes } from "@/server/sustentabilidade/painel-pdf";

// "Relatório de Sustentabilidade do mês" em PDF (spec 4.9): /sustentabilidade/
// relatorio/2026-10 gera uma página no papel timbrado com o ano até aquele
// mês e a comparação com o ano anterior. Quem vê o painel gera; valores em
// reais só para quem tem "Ver valores" (o painel já monta sem eles). Ao
// gerar, conclui o chamado recorrente "Relatório de Sustentabilidade do mês".
export const maxDuration = 60;

const MES = /^(\d{4})-(0[1-9]|1[0-2])$/;

export async function GET(
  _request: Request,
  ctx: RouteContext<"/sustentabilidade/relatorio/[mes]">,
) {
  const mes = (await ctx.params).mes;
  const m = MES.exec(mes);
  if (!m) return new Response("Mês inválido. Use aaaa-mm.", { status: 400 });
  const ano = Number(m[1]);
  const ateMes = Number(m[2]);
  const hoje = hojeEmBrasilia(new Date());
  if (mes > hoje.slice(0, 7))
    return new Response("Esse mês ainda não começou.", { status: 400 });
  if (!(await podeAgora("sustentabilidade.painel")))
    return new Response("Você não tem acesso ao painel de Sustentabilidade.", {
      status: 403,
    });

  const usuario = await usuarioAtual();
  const filtros = { ano, ateMes, comparar: true };
  const dados = await dadosDoPainel(filtros);
  const nomeDoMes = NOMES_DOS_MESES[ateMes - 1] ?? "";
  const mesPorExtenso = `${nomeDoMes.charAt(0).toUpperCase()}${nomeDoMes.slice(1)} de ${ano}`;
  const pdf = await gerarRelatorioDoMes({
    mes: mesPorExtenso,
    periodo: periodoEscrito(filtros),
    anoAnterior: String(ano - 1),
    geradoEm: `${formatarDataHora(new Date().toISOString())}, por ${usuario.nome}`,
    cartoes: dados.painel.cartoes,
    comparacao: dados.painel.comparacao,
    graficos: dados.painel.graficos,
    equivalencias: dados.painel.equivalencias,
    exemplo: dados.exemplo,
  });

  // O chamado do relatório fecha ao gerar o do mês passado ou o do atual
  // (gerar um relatório antigo não fecha o lembrete de agora).
  const mesPassado =
    Number(hoje.slice(5, 7)) === 1
      ? `${Number(hoje.slice(0, 4)) - 1}-12`
      : `${hoje.slice(0, 4)}-${String(Number(hoje.slice(5, 7)) - 1).padStart(2, "0")}`;
  if (mes >= mesPassado) {
    try {
      const aberto = await chamadoAbertoDaOrigem(
        "sustentabilidade",
        "relatorio",
      );
      if (aberto)
        await concluirPeloSistema({
          chamadoId: aberto.id,
          texto: `Relatório de ${mesPorExtenso.toLowerCase()} gerado por ${usuario.nome} em ${formatarData(hoje)}.`,
          concluidoPor: usuario.id,
        });
    } catch (erro) {
      // O PDF sai de qualquer jeito; o chamado a equipe fecha à mão.
      console.error("concluir o chamado do relatório", erro);
    }
  }

  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="relatorio-sustentabilidade-${mes}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
