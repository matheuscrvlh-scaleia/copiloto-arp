import { Linhas } from "@/components/dashboard/graficos/linhas";
import { formatarData } from "@/lib/formato";
import { somarDias } from "@/lib/os/tempo";
import type { PontoSemanal } from "@/lib/sustentabilidade/rondas";

// Ocupação média por semana (spec 4.6): uma linha para pretos e outra para
// azuis nas últimas 12 semanas. Semana sem ronda fica sem ponto (não é zero).

export function GraficoSemanal({ semanas }: { semanas: PontoSemanal[] }) {
  const sem = semanas.every((s) => s.preto === null && s.azul === null);
  if (sem)
    return (
      <p className="py-6 text-sm text-neutral-500">
        Nenhuma ronda nas últimas {semanas.length} semanas. O gráfico aparece
        depois que uma ronda for lançada.
      </p>
    );
  return (
    <div data-guia="su-rondas-grafico">
      <Linhas
        unidade="pct"
        descricao="Ocupação média dos coletores por semana, pretos e azuis, nas últimas 12 semanas"
        pontos={semanas.map((s) => ({
          chave: s.semana,
          rotulo: `${s.semana.slice(8, 10)}/${s.semana.slice(5, 7)}`,
          titulo: `Semana de ${formatarData(s.semana)} a ${formatarData(somarDias(s.semana, 6))}`,
        }))}
        series={[
          {
            chave: "preto",
            rotulo: "Pretos (não recicláveis)",
            cor: "neutro",
            valores: semanas.map((s) => s.preto),
          },
          {
            chave: "azul",
            rotulo: "Azuis (recicláveis)",
            cor: 1,
            valores: semanas.map((s) => s.azul),
          },
        ]}
      />
    </div>
  );
}
