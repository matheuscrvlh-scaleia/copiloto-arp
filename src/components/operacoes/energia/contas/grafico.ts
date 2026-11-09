import type {
  CorSerie,
  PontoEixo,
  Serie,
} from "@/components/dashboard/graficos/series";
import { formatarMes } from "@/lib/formato";
import {
  type FaturaConta,
  nomeDaUnidade,
  seriePorUnidade,
  type UnidadeEnergia,
} from "@/lib/operacoes/energisa-contas";
import { mesCurto } from "./comum";

// Dados do gráfico de consumo por mês e por unidade (montado com as faturas
// importadas: no PDF os kWh do histórico só estão no gráfico, que o leitor
// não lê). A paleta tem 5 cores: com mais unidades, as 4 de maior consumo e
// "Outras unidades" (cinza) somadas.

const CORES: CorSerie[] = [1, 2, 3, 4, 5];

export function pontosDosMeses(meses: string[]): PontoEixo[] {
  return meses.map((m) => ({
    chave: m,
    rotulo: mesCurto(m),
    titulo: formatarMes(m),
  }));
}

export function seriesDoConsumo(
  faturas: FaturaConta[],
  meses: string[],
  unidades: Map<string, UnidadeEnergia>,
): Serie[] {
  const porUnidade = [...seriePorUnidade(faturas, meses, "consumo_kwh")]
    .map(([matricula, valores]) => ({
      matricula,
      valores,
      soma: valores.reduce<number>((s, v) => s + (v ?? 0), 0),
    }))
    .sort((a, b) => b.soma - a.soma || a.matricula.localeCompare(b.matricula));
  const cabem = porUnidade.length <= CORES.length;
  const principais = cabem ? porUnidade : porUnidade.slice(0, CORES.length - 1);
  // A cor segue a matrícula (ordem fixa), não o ranking do mês.
  const ordem = [...principais].sort((a, b) =>
    a.matricula.localeCompare(b.matricula),
  );
  const series: Serie[] = ordem.map((u, i) => ({
    chave: u.matricula,
    rotulo: nomeDaUnidade(u.matricula, unidades.get(u.matricula)),
    cor: CORES[i] ?? "neutro",
    valores: u.valores,
  }));
  if (!cabem) {
    const resto = porUnidade.slice(CORES.length - 1);
    series.push({
      chave: "outras",
      rotulo: `Outras ${resto.length} unidades`,
      cor: "neutro",
      valores: meses.map((_, k) => {
        const vs = resto.map((u) => u.valores[k]);
        return vs.every((v) => v === null)
          ? null
          : vs.reduce<number>((s, v) => s + (v ?? 0), 0);
      }),
    });
  }
  return series;
}
