import { Secao } from "@/components/dashboard/tabela";
import { formatarNumero } from "@/lib/formato";
import type { efeitoDoEvento } from "@/lib/marketing/publico";

// Efeito do evento (ideia do Placer.ai): média de entradas nos fins de
// semana com evento × sem evento, nas mesmas 12 semanas do gráfico.

export function EfeitoDoEvento({
  efeito,
  semanas,
}: {
  efeito: ReturnType<typeof efeitoDoEvento>;
  semanas: number;
}) {
  const { comEvento, semEvento, nCom, nSem, diferencaPct } = efeito;
  const media = (v: number | null) => (v === null ? "—" : formatarNumero(v));
  return (
    <Secao
      tom="escuro"
      titulo="Efeito do evento"
      descricao={`Média de entradas por fim de semana (sábado + domingo), nas últimas ${semanas} semanas`}
    >
      <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
        <div>
          <p className="text-neutral-400">
            Com evento ({nCom} {nCom === 1 ? "fim de semana" : "fins de semana"}
            )
          </p>
          <p className="text-2xl font-semibold tabular-nums">
            {media(comEvento)}
          </p>
        </div>
        <div>
          <p className="text-neutral-400">
            Sem evento ({nSem} {nSem === 1 ? "fim de semana" : "fins de semana"}
            )
          </p>
          <p className="text-2xl font-semibold tabular-nums">
            {media(semEvento)}
          </p>
        </div>
        <div>
          <p className="text-neutral-400">Diferença</p>
          <p className="text-2xl font-semibold tabular-nums">
            {diferencaPct === null
              ? "—"
              : `${diferencaPct > 0 ? "+" : ""}${formatarNumero(diferencaPct, 1)}%`}
          </p>
        </div>
      </div>
      <p className="mt-4 text-xs text-neutral-400">
        Comparação simples entre médias: outras coisas mudam de um fim de semana
        para outro (clima, feriado, época do mês). Com poucos fins de semana de
        um lado, leia com cuidado.
      </p>
    </Secao>
  );
}
