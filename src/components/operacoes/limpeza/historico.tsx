import Link from "next/link";
import { formatarData, formatarDataHora } from "@/lib/formato";
import { nomeDoMes, ROTULO_REGRA_BL04, reais } from "@/lib/operacoes/limpeza";
import type { ResumoDoMes } from "@/server/operacoes/limpeza";
import { SeloConferencia, SeloEnvio, SeloMes } from "./campos";

// Histórico dos meses do rateio, com a situação de cada um (aberto,
// fechado, incompleto), a conferência e o envio ao Financeiro.

const celula = "px-2 py-2";

export function HistoricoDoRateio({
  meses,
  atual,
}: {
  meses: ResumoDoMes[];
  atual: string | null;
}) {
  if (!meses.length)
    return (
      <p className="py-6 text-sm text-neutral-500">
        Nenhum mês lançado. Comece com &ldquo;Novo mês&rdquo; ou importe o
        histórico da planilha em Operações › Importações.
      </p>
    );
  const total = meses.reduce((s, m) => s + (m.total ?? 0), 0);
  return (
    <div data-guia="op-limpeza-historico" className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-[52rem] border-collapse text-sm">
        <caption className="sr-only">
          Meses do rateio com a situação de cada um
        </caption>
        <thead>
          <tr className="text-left text-xs text-neutral-500">
            <th className={celula}>Mês</th>
            <th className={celula}>Situação</th>
            <th className={`${celula} text-right`}>Total (R$)</th>
            <th className={celula}>Conferência</th>
            <th className={celula}>Envio ao Financeiro</th>
            <th className={celula}>Origem</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-900/[0.06]">
          {meses.map((m) => (
            <tr
              key={m.referencia}
              aria-current={m.referencia === atual ? "true" : undefined}
              className="transition-colors hover:bg-white/50 aria-[current=true]:bg-white/60"
            >
              <th scope="row" className={`${celula} text-left font-medium`}>
                <Link
                  href={`/operacoes/limpeza?mes=${m.referencia.slice(0, 7)}`}
                  className="underline-offset-4 hover:underline"
                >
                  {nomeDoMes(m.referencia)}
                </Link>
                {m.exemplo && (
                  <span className="ml-1.5 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                    exemplo
                  </span>
                )}
              </th>
              <td className={celula}>
                <SeloMes status={m.status} incompleto={m.incompleto} />
              </td>
              <td className={`${celula} text-right tabular-nums`}>
                {reais(m.total)}
                {m.difereDaPlanilha && (
                  <span className="block text-[11px] text-amber-800">
                    difere da planilha
                  </span>
                )}
              </td>
              <td className={celula}>
                <SeloConferencia situacao={m.conferencia} />
              </td>
              <td className={celula}>
                <SeloEnvio situacao={m.envio} />
                <span className="block text-[11px] text-neutral-500">
                  {m.enviadoEm
                    ? `em ${formatarDataHora(m.enviadoEm)}`
                    : m.envio === "historico"
                      ? "repassado fora do sistema"
                      : `prazo ${formatarData(m.prazo)}`}
                </span>
              </td>
              <td className={`${celula} text-xs text-neutral-600`}>
                {m.origem === "importacao" ? "Planilha" : "Tela"}
                {m.regraBl04 === "area_comum" && (
                  <span className="block text-[11px] text-neutral-500">
                    {ROTULO_REGRA_BL04.area_comum}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-neutral-300 font-semibold">
            <td className={celula}>{meses.length} meses</td>
            <td />
            <td className={`${celula} text-right tabular-nums`}>
              {reais(total)}
            </td>
            <td colSpan={3} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
