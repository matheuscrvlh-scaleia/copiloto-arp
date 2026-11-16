import Link from "next/link";
import { Secao } from "@/components/dashboard/tabela";
import { formatarDataHora } from "@/lib/formato";
import {
  CHAMADOS_FIXOS,
  type ChamadoFixo,
} from "@/lib/sustentabilidade/painel-parametros";
import {
  candidatosAResponsavel,
  type EstadoDoChamadoFixo,
} from "@/server/sustentabilidade/chamados-fixos";
import { CriarChamadoRecorrente } from "./criar-chamado";

// Chamados fixos do módulo (spec 4.11): recorrência e responsável ficam no
// próprio chamado ("Repetir" do Chamados), não aqui. Esta seção só cria o
// primeiro chamado recorrente de cada rotina e mostra se ele já existe.

// Sugestão de dia: ronda na terça (2), nota do RCC no dia 5, relatório no
// último dia do mês (31 vale o último dia, mesmo nos meses curtos).
const DIA_SUGERIDO: Record<ChamadoFixo, number> = {
  ronda: 2,
  rcc: 5,
  relatorio: 31,
};

export async function ChamadosFixos({
  quais,
  estados,
}: {
  quais: ChamadoFixo[];
  estados: EstadoDoChamadoFixo[];
}) {
  const candidatos = new Map(
    await Promise.all(
      quais.map(async (t) => [t, await candidatosAResponsavel(t)] as const),
    ),
  );
  return (
    <Secao
      titulo="Chamados recorrentes"
      descricao="Recorrência e responsável são configurados no próprio chamado, com “Repetir”. Aqui você cria o primeiro de cada rotina; os seguintes nascem sozinhos."
    >
      <div data-guia="su-chamados-fixos" className="flex flex-col gap-5">
        {quais.map((tipo) => {
          const def = CHAMADOS_FIXOS[tipo];
          const aberto = estados.find((e) => e.tipo === tipo)?.aberto;
          return (
            <div
              key={tipo}
              className="flex flex-col gap-2 border-b border-neutral-900/[0.06] pb-5 last:border-0 last:pb-0"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="text-sm font-medium">{def.titulo}</p>
                <span className="text-xs text-neutral-500">
                  {def.descricao}
                </span>
              </div>
              {aberto ? (
                <p className="text-sm text-neutral-700">
                  Já existe:{" "}
                  <Link
                    href={aberto.href}
                    className="font-medium underline underline-offset-4"
                  >
                    chamado #{aberto.numero}
                  </Link>
                  {aberto.repeticao ? ` · ${aberto.repeticao}` : ""}
                  {aberto.responsavel
                    ? ` · responsável: ${aberto.responsavel}`
                    : ""}
                  {aberto.prazo
                    ? ` · prazo ${formatarDataHora(aberto.prazo)}`
                    : ""}
                  . Para mudar o dia ou o responsável, use o “Repetir” e o
                  responsável direto no chamado.
                </p>
              ) : (
                <CriarChamadoRecorrente
                  tipo={tipo}
                  candidatos={candidatos.get(tipo) ?? []}
                  diaPadrao={DIA_SUGERIDO[tipo]}
                />
              )}
            </div>
          );
        })}
      </div>
    </Secao>
  );
}
