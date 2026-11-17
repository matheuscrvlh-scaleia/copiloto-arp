import { formatarDataHora } from "@arp/shared/formato";
import {
  CHAMADOS_FIXOS,
  type ChamadoFixo,
} from "@arp/shared/sustentabilidade/painel-parametros";
import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";
import { Secao } from "@/components/dashboard/tabela";
import { Link } from "@/lib/navegacao";
import {
  consultaDosCandidatos,
  consultaDosChamadosFixos,
} from "../../api-config";
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

export function ChamadosFixos({ quais }: { quais: ChamadoFixo[] }) {
  const { data: estados } = useSuspenseQuery(consultaDosChamadosFixos);
  const listas = useSuspenseQueries({
    queries: quais.map((t) => consultaDosCandidatos(t)),
  });
  const candidatos = new Map(quais.map((t, i) => [t, listas[i]?.data ?? []]));
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
