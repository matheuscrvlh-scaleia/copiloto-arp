import { Fragment } from "react";
import type { CelulaExportar, ColunaExportar } from "@/components/os/exportar";
import {
  atingiuMeta,
  type Formato,
  INDICADORES_PAINEL,
  type LinhaPainel,
  MESES_CURTOS,
  type OrigemOcupacao,
} from "@/lib/comercial/painel";
import { formatarNumero, formatarPct } from "@/lib/formato";

// Grade do Painel de indicadores (spec 4.10): por indicador, Plan, Real e
// % atingido de janeiro a dezembro e o acumulado. % atingido ruim em
// vermelho (abaixo de 100%; nos de "menor é melhor", acima de 100%).

function formatar(v: number | null, f: Formato): string {
  if (v === null) return "";
  if (f === "pct") return formatarPct(v, 2);
  if (f === "numero") return formatarNumero(v);
  return formatarNumero(v, 2);
}

const DICA_ORIGEM: Record<OrigemOcupacao, string> = {
  foto: "Foto da ocupação no último dia do mês",
  hoje: "Mês corrente: ocupação de hoje no ENET (a foto é guardada no último dia)",
  calculado:
    "Sem foto guardada: calculado pelos contratos do ENET de exemplo ativos no fim do mês",
  sem_historico: "Sem foto da ocupação deste mês",
};

/** Nome do indicador com o rótulo de número parcial, quando houver. */
export function nomeDoIndicador(l: LinhaPainel): string {
  const def: { nome: string; parcial?: string } =
    INDICADORES_PAINEL[l.indicador];
  return def.parcial ? `${def.nome} (${def.parcial})` : def.nome;
}

function CelulaReal({
  valor,
  formato,
  origem,
}: {
  valor: number | null;
  formato: Formato;
  origem: OrigemOcupacao | null;
}) {
  if (origem === "sem_historico")
    return (
      <span
        className="text-[11px] text-neutral-400"
        title={DICA_ORIGEM[origem]}
      >
        sem histórico
      </span>
    );
  return (
    <span
      title={origem ? DICA_ORIGEM[origem] : undefined}
      className={valor !== null && valor < 0 ? "text-red-700" : ""}
    >
      {formatar(valor, formato)}
      {origem === "calculado" && <sup className="text-amber-700">*</sup>}
      {origem === "hoje" && <sup className="text-neutral-400">h</sup>}
    </span>
  );
}

function CelulaAtingido({
  valor,
  direcao,
}: {
  valor: number | null;
  direcao: "maior_melhor" | "menor_melhor";
}) {
  if (valor === null) return null;
  return (
    <span
      className={
        atingiuMeta(valor, direcao)
          ? "text-green-800"
          : "font-semibold text-red-700"
      }
    >
      {formatarPct(valor, 1)}
    </span>
  );
}

const td = "px-2 py-1.5 text-right tabular-nums whitespace-nowrap";

export function GradePainel({ linhas }: { linhas: LinhaPainel[] }) {
  return (
    <div className="-mx-2 overflow-auto">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-white/85 backdrop-blur">
          <tr className="border-b border-neutral-200 text-xs text-neutral-500">
            <th className="px-2 py-2 text-left font-medium">Indicador</th>
            {MESES_CURTOS.map((m) => (
              <th key={m} className="px-2 py-2 text-right font-medium">
                {m}
              </th>
            ))}
            <th className="px-2 py-2 text-right font-medium">Acumulado</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const def = INDICADORES_PAINEL[l.indicador];
            return (
              <Fragment key={l.indicador}>
                <tr className="border-t border-neutral-300">
                  <th
                    colSpan={14}
                    scope="rowgroup"
                    title={def.calculo}
                    className="px-2 pt-3 pb-1 text-left font-semibold text-neutral-900"
                  >
                    {nomeDoIndicador(l)}
                    {def.direcao === "menor_melhor" && def.meta && (
                      <span className="ml-2 text-[11px] font-normal text-neutral-500">
                        menor é melhor
                      </span>
                    )}
                  </th>
                </tr>
                {def.meta && (
                  <tr className="text-neutral-500">
                    <th
                      scope="row"
                      className="px-2 py-1.5 pl-4 text-left text-xs font-medium"
                    >
                      Plan
                    </th>
                    {l.plan.map((v, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: a posição é o mês
                      <td key={i} className={td}>
                        {formatar(v, def.formato)}
                      </td>
                    ))}
                    <td className={td}>
                      {formatar(l.acumulado.plan, def.formato)}
                    </td>
                  </tr>
                )}
                <tr>
                  <th
                    scope="row"
                    className="px-2 py-1.5 pl-4 text-left text-xs font-medium text-neutral-700"
                  >
                    Real
                  </th>
                  {l.real.map((v, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: a posição é o mês
                    <td key={i} className={td}>
                      <CelulaReal
                        valor={v}
                        formato={def.formato}
                        origem={l.marcas[i] ?? null}
                      />
                    </td>
                  ))}
                  <td className={`${td} font-semibold`}>
                    {formatar(l.acumulado.real, def.formato)}
                  </td>
                </tr>
                {def.meta && (
                  <tr className="border-b border-neutral-900/[0.06]">
                    <th
                      scope="row"
                      className="px-2 py-1.5 pl-4 text-left text-xs font-medium text-neutral-500"
                    >
                      % atingido
                    </th>
                    {l.atingido.map((v, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: a posição é o mês
                      <td key={i} className={td}>
                        <CelulaAtingido valor={v} direcao={def.direcao} />
                      </td>
                    ))}
                    <td className={td}>
                      <CelulaAtingido
                        valor={l.acumulado.atingido}
                        direcao={def.direcao}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exportar (as mesmas linhas da grade)
// ---------------------------------------------------------------------------

export const COLUNAS_EXPORTAR_PAINEL: ColunaExportar[] = [
  { titulo: "Indicador" },
  { titulo: "Linha" },
  ...MESES_CURTOS.map((m) => ({
    titulo: m,
    numero: true,
    formato: "#,##0.00",
  })),
  { titulo: "Acumulado", numero: true, formato: "#,##0.00" },
];

export function linhasExportarPainel(
  linhas: LinhaPainel[],
): CelulaExportar[][] {
  const r = (v: number | null) =>
    v === null ? null : Math.round(v * 100) / 100;
  return linhas.flatMap((l) => {
    const def = INDICADORES_PAINEL[l.indicador];
    const nome = nomeDoIndicador(l);
    const real: CelulaExportar[] = [
      nome,
      "Real",
      ...l.real.map((v, i) =>
        l.marcas[i] === "sem_historico" ? "sem histórico" : r(v),
      ),
      r(l.acumulado.real),
    ];
    if (!def.meta) return [real];
    return [
      [nome, "Plan", ...l.plan.map(r), r(l.acumulado.plan)],
      real,
      [nome, "% atingido", ...l.atingido.map(r), r(l.acumulado.atingido)],
    ];
  });
}
