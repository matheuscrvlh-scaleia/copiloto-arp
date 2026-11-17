import {
  formatarPercentual,
  formatarToneladas,
} from "@arp/shared/sustentabilidade/formatos";
import type { MesRcc } from "@arp/shared/sustentabilidade/rcc-lista";
import { useState } from "react";

// Toneladas por mês (spec 4.7): classe A e classe B lado a lado e, embaixo,
// o % reciclado em linha. São dois quadros alinhados pelos mesmos meses, cada
// um com a sua escala (nunca dois eixos no mesmo quadro). Mês sem nota fica
// vazio: não é zero. O número exato de cada mês está na lista.

const MESES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];
const COR_A = "var(--serie-1)";
const COR_B = "var(--serie-2)";

type Mes = Pick<
  MesRcc,
  "competencia" | "toneladasA" | "toneladasB" | "total" | "pctReciclado"
>;

export function GraficoRcc({ ano, meses }: { ano: number; meses: Mes[] }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const casas = Array.from({ length: 12 }, (_, i) =>
    meses.find(
      (m) => m.competencia === `${ano}-${String(i + 1).padStart(2, "0")}-01`,
    ),
  );
  if (!meses.length)
    return (
      <p className="py-6 text-sm text-neutral-500">
        Nenhuma nota em {ano}. O gráfico aparece depois que uma nota for
        lançada.
      </p>
    );
  const max = Math.max(
    ...meses.flatMap((m) => [m.toneladasA, m.toneladasB]),
    1,
  );
  const x = (i: number) => ((i + 0.5) / 12) * 100;
  const pontos = casas.flatMap((m, i) =>
    m && m.pctReciclado !== null ? [{ i, y: m.pctReciclado }] : [],
  );
  const selecionado = ativo === null ? null : (casas[ativo] ?? null);

  return (
    <div data-guia="su-rcc-grafico" className="flex flex-col gap-3">
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-700">
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-sm"
            style={{ background: COR_A }}
          />
          Classe A (reciclável)
        </li>
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-sm"
            style={{ background: COR_B }}
          />
          Classe B (descarte)
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 rounded bg-neutral-800" />%
          reciclado (quadro de baixo)
        </li>
      </ul>

      <p className="min-h-5 text-sm text-neutral-800" aria-live="polite">
        {selecionado ? (
          <>
            <span className="font-medium">
              {MESES[ativo ?? 0]}/{ano}
            </span>
            : A {formatarToneladas(selecionado.toneladasA)} t · B{" "}
            {formatarToneladas(selecionado.toneladasB)} t · total{" "}
            {formatarToneladas(selecionado.total)} t ·{" "}
            {formatarPercentual(selecionado.pctReciclado)} reciclado
          </>
        ) : (
          <span className="text-neutral-500">
            Passe o mouse, toque ou use Tab sobre um mês para ver os números.
          </span>
        )}
      </p>

      <div className="flex flex-col gap-1">
        <p className="text-[11px] text-neutral-500">Toneladas</p>
        <div className="grid grid-cols-[3rem_1fr] gap-x-2">
          <div className="flex h-44 flex-col justify-between text-right text-[11px] tabular-nums text-neutral-500">
            <span>{formatarToneladas(max)}</span>
            <span>0</span>
          </div>
          <div
            className="relative flex h-44 items-end border-b border-neutral-300"
            onPointerLeave={() => setAtivo(null)}
          >
            <span className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-neutral-900/[0.06]" />
            <span className="pointer-events-none absolute inset-x-0 top-0 border-t border-neutral-900/[0.06]" />
            {casas.map((m, i) => (
              <button
                // biome-ignore lint/suspicious/noArrayIndexKey: 12 meses fixos
                key={i}
                type="button"
                disabled={!m}
                onPointerEnter={() => setAtivo(i)}
                onFocus={() => setAtivo(i)}
                onBlur={() => setAtivo(null)}
                aria-label={
                  m
                    ? `${MESES[i]}/${ano}: A ${formatarToneladas(m.toneladasA)} t, B ${formatarToneladas(m.toneladasB)} t`
                    : `${MESES[i]}/${ano}: sem nota`
                }
                className={`relative flex h-full flex-1 items-end justify-center gap-0.5 px-0.5 outline-none focus-visible:bg-neutral-900/[0.05] ${ativo === i ? "bg-neutral-900/[0.04]" : ""}`}
              >
                {m && (
                  <>
                    <span
                      className="w-full max-w-5 rounded-t-[4px]"
                      style={{
                        height: `${(m.toneladasA / max) * 100}%`,
                        minHeight: m.toneladasA > 0 ? 2 : 0,
                        background: COR_A,
                      }}
                    />
                    <span
                      className="w-full max-w-5 rounded-t-[4px]"
                      style={{
                        height: `${(m.toneladasB / max) * 100}%`,
                        minHeight: m.toneladasB > 0 ? 2 : 0,
                        background: COR_B,
                      }}
                    />
                  </>
                )}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-2 text-[11px] text-neutral-500">% reciclado</p>
        <div className="grid grid-cols-[3rem_1fr] gap-x-2">
          <div className="flex h-24 flex-col justify-between text-right text-[11px] tabular-nums text-neutral-500">
            <span>100%</span>
            <span>0%</span>
          </div>
          <div className="relative h-24 border-b border-neutral-300">
            <span className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-neutral-900/[0.06]" />
            <span className="pointer-events-none absolute inset-x-0 top-0 border-t border-neutral-900/[0.06]" />
            <svg
              aria-hidden
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 size-full overflow-visible text-neutral-800"
            >
              <title>% reciclado por mês</title>
              <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                points={pontos.map((p) => `${x(p.i)},${100 - p.y}`).join(" ")}
              />
            </svg>
            {pontos.map((p) => (
              <span
                key={p.i}
                aria-hidden
                className={`absolute size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white bg-neutral-800 ${ativo === p.i ? "scale-125" : ""}`}
                style={{ left: `${x(p.i)}%`, bottom: `${p.y}%` }}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[3rem_1fr] gap-x-2">
          <span />
          <div className="flex text-center text-[11px] text-neutral-500">
            {MESES.map((m, i) => (
              <span
                key={m}
                className={`flex-1 ${ativo === i ? "font-medium text-neutral-900" : ""}`}
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
