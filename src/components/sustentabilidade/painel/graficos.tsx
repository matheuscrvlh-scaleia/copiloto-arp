import { Colunas } from "@/components/dashboard/graficos/colunas";
import { ColunasEmpilhadas } from "@/components/dashboard/graficos/colunas-empilhadas";
import { Linhas } from "@/components/dashboard/graficos/linhas";
import type { PontoEixo, Serie } from "@/components/dashboard/graficos/series";
import { Secao } from "@/components/dashboard/tabela";
import { formatarNumero } from "@/lib/formato";
import type { GraficoDoPainel } from "@/lib/sustentabilidade/painel-montagem";

// Gráficos do Painel (spec 4.9): volume reciclado, energia, RCC (classe A e B)
// e pessoas impactadas, mês a mês, com o ano anterior quando "comparar" está
// ligado. Mês sem dado aparece sem coluna (nunca como zero).

function paraSeries(g: GraficoDoPainel): {
  pontos: PontoEixo[];
  series: Serie[];
} {
  return {
    pontos: g.meses.map((m, i) => ({ chave: String(i), rotulo: m })),
    series: g.series.map((s) => ({
      chave: s.chave,
      rotulo: s.rotulo,
      cor: s.cor,
      valores: s.valores,
    })),
  };
}

function Grafico({ g }: { g: GraficoDoPainel }) {
  const descricao = `${g.titulo}, de ${g.meses[0]} a ${g.meses.at(-1)}`;
  const { pontos, series } = paraSeries(g);
  if (g.empilhado)
    return (
      <ColunasEmpilhadas
        pontos={pontos}
        series={series}
        descricao={descricao}
      />
    );
  if (series.length === 1) {
    const s = g.series[0];
    return (
      <Colunas
        descricao={descricao}
        rotularTodas={g.meses.length <= 6}
        itens={g.meses.map((m, i) => {
          const v = s?.valores[i] ?? null;
          return {
            chave: String(i),
            rotulo: m,
            valor: v ?? 0,
            texto:
              v === null
                ? "sem dado"
                : `${formatarNumero(v, g.casas)} ${g.unidade}`,
          };
        })}
      />
    );
  }
  return <Linhas pontos={pontos} series={series} descricao={descricao} />;
}

export function GraficosDoPainel({
  graficos,
}: {
  graficos: GraficoDoPainel[];
}) {
  return (
    <div data-guia="painel-graficos" className="grid gap-6 xl:grid-cols-2">
      {graficos.map((g) => (
        <Secao key={g.chave} titulo={g.titulo} descricao={g.nota}>
          <Grafico g={g} />
        </Secao>
      ))}
    </div>
  );
}
