"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatarMes, formatarMoeda, formatarNumero } from "@/lib/formato";

// Custo de manutenção do ativo desde a compra: o acumulado em área, o gasto
// de cada mês em colunas finas no pé (mesmo eixo, em reais) e uma linha
// tracejada no valor de reposição — quando a área encosta nela, a
// manutenção já custou um equipamento novo. Mesmo visual dos gráficos do
// painel (dashboard/graficos.tsx): dica de vidro fumê, mira que segue o
// mouse e setas pelo teclado.

export interface MesDoGrafico {
  /** "aaaa-mm" */
  mes: string;
  valor: number;
  acumulado: number;
}

const L = 640;
const A = 220;
const M = { x: 12, topo: 26, base: 6 };

/** Topo do eixo com passo redondo (1, 2, 2,5 ou 5 × 10ⁿ), até 5 divisões. */
function eixo(max: number): { teto: number; passo: number } {
  const alvo = Math.max(max, 1);
  const base = 10 ** Math.floor(Math.log10(alvo));
  for (const m of [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10]) {
    const passo = base * m;
    const teto = Math.ceil((alvo * 1.08) / passo) * passo;
    if (teto / passo <= 5) return { teto, passo };
  }
  return { teto: alvo, passo: alvo };
}

/** Valor curto do eixo: "R$ 12 mil", "R$ 800". */
function curto(v: number): string {
  if (v >= 1_000_000) return `R$ ${formatarNumero(v / 1_000_000, 1)} mi`;
  if (v >= 1000) return `R$ ${formatarNumero(v / 1000, v % 1000 ? 1 : 0)} mil`;
  return `R$ ${formatarNumero(v)}`;
}

export function GraficoCustoAtivo({
  meses,
  reposicao,
}: {
  meses: MesDoGrafico[];
  reposicao: number | null;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const [montado, setMontado] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const gradiente = `custo-${useId().replace(/:/g, "")}`;
  useEffect(() => {
    const id = requestAnimationFrame(() => setMontado(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const n = meses.length;
  const maximo = Math.max(...meses.map((m) => m.acumulado), reposicao ?? 0, 0);
  const { teto, passo: passoEixo } = eixo(maximo);
  const util = A - M.topo - M.base;
  const y = (v: number) => M.topo + (1 - Math.max(v, 0) / teto) * util;
  const passo = n > 1 ? (L - M.x * 2) / (n - 1) : 0;
  const x = (k: number) => (n > 1 ? M.x + k * passo : L / 2);
  const chao = y(0);
  const pts = meses.map((m, k) => ({ x: x(k), y: y(m.acumulado) }));
  // Degraus: o acumulado só muda quando há gasto no mês.
  const linha = pts
    .map((p, k) => (k === 0 ? `M ${p.x} ${p.y}` : `H ${p.x} V ${p.y}`))
    .join(" ");
  const ultimo = pts.at(-1);
  const area = ultimo
    ? `${linha} L ${ultimo.x} ${chao} L ${pts[0]?.x ?? 0} ${chao} Z`
    : "";
  const largura = Math.max(2, Math.min(14, passo * 0.5));
  const cada = Math.max(1, Math.ceil(n / 8));

  function apontar(e: React.PointerEvent) {
    const r = svg.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    const xv = ((e.clientX - r.left) / r.width) * L;
    const k = passo === 0 ? 0 : Math.round((xv - M.x) / passo);
    setAtivo(Math.max(0, Math.min(n - 1, k)));
  }

  const atual = ativo ?? n - 1;
  const item = meses[atual];
  const ponto = pts[atual];
  const descricao =
    "Custo de manutenção acumulado desde a compra, mês a mês, comparado ao valor de reposição";

  if (n === 0) return null;
  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 rounded-full bg-neutral-900" />
          Acumulado
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-3 w-1.5 rounded-sm bg-neutral-900/25"
          />
          Gasto no mês
        </span>
        {reposicao !== null && (
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="w-4 border-t-2 border-dashed border-neutral-500"
            />
            Valor de reposição ({formatarMoeda(reposicao)})
          </span>
        )}
      </figcaption>
      <div
        className="relative touch-pan-y rounded-2xl select-none has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-neutral-900/25 has-[input:focus-visible]:ring-offset-4 has-[input:focus-visible]:ring-offset-transparent"
        onPointerMove={apontar}
        onPointerDown={apontar}
        onPointerLeave={() => setAtivo(null)}
      >
        <svg
          ref={svg}
          viewBox={`0 0 ${L} ${A}`}
          className="w-full overflow-visible text-neutral-900"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradiente} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#58c069" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#58c069" stopOpacity="0" />
            </linearGradient>
          </defs>
          {Array.from(
            { length: Math.round(teto / passoEixo) + 1 },
            (_, i) => i * passoEixo,
          ).map((v) => (
            <g key={v}>
              <line
                x1={0}
                x2={L}
                y1={y(v)}
                y2={y(v)}
                className="stroke-neutral-900/10"
                strokeWidth={1}
              />
              {v > 0 && (
                <text
                  x={0}
                  y={y(v) - 5}
                  className="fill-neutral-400 text-[10px]"
                >
                  {curto(v)}
                </text>
              )}
            </g>
          ))}
          {meses.map((m, k) =>
            m.valor > 0 ? (
              <rect
                key={m.mes}
                x={x(k) - largura / 2}
                width={largura}
                y={montado ? y(m.valor) : chao}
                height={montado ? Math.max(chao - y(m.valor), 2) : 0}
                rx={Math.min(3, largura / 2)}
                className={`transition-all duration-700 ease-out motion-reduce:transition-none ${k === ativo ? "fill-neutral-900/50" : "fill-neutral-900/20"}`}
              />
            ) : null,
          )}
          <path
            d={area}
            fill={`url(#${gradiente})`}
            className="transition-opacity duration-1000 motion-reduce:transition-none"
            style={{ opacity: montado ? 1 : 0 }}
          />
          <path
            d={linha}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {reposicao !== null && (
            <g>
              <line
                x1={0}
                x2={L}
                y1={y(reposicao)}
                y2={y(reposicao)}
                className="stroke-neutral-500"
                strokeWidth={1.5}
                strokeDasharray="6 5"
              />
              <text
                x={L}
                y={y(reposicao) - 6}
                textAnchor="end"
                className="fill-neutral-600 text-[11px] font-medium"
              >
                Reposição {curto(reposicao)}
              </text>
            </g>
          )}
          {ponto && (
            <g>
              {ativo !== null && (
                <line
                  x1={ponto.x}
                  x2={ponto.x}
                  y1={M.topo - 14}
                  y2={chao}
                  stroke="currentColor"
                  strokeOpacity={0.3}
                  strokeDasharray="3 4"
                />
              )}
              <circle cx={ponto.x} cy={ponto.y} r={7} className="fill-white" />
              <circle cx={ponto.x} cy={ponto.y} r={4.5} fill="#58c069" />
            </g>
          )}
        </svg>
        {ponto && item && (
          <div
            className="fume pointer-events-none absolute z-20 rounded-2xl px-3 py-2 text-xs whitespace-nowrap transition-[left,top] duration-150 ease-out motion-reduce:transition-none"
            style={{
              left: `${(ponto.x / L) * 100}%`,
              top: `${(ponto.y / A) * 100}%`,
              transform: `translate(${ponto.x / L < 0.2 ? "-8%" : ponto.x / L > 0.8 ? "-92%" : "-50%"}, calc(-100% - 12px))`,
              backgroundColor: "rgb(14 14 14 / 0.86)",
            }}
          >
            <p className="text-[rgb(255_255_255/0.6)]">
              {formatarMes(item.mes)}
            </p>
            <p className="text-sm font-semibold tabular-nums">
              {formatarMoeda(item.acumulado)} acumulado
            </p>
            <p className="mt-0.5 text-[rgb(255_255_255/0.65)]">
              {formatarMoeda(item.valor)} no mês
              {reposicao
                ? ` · ${formatarNumero((item.acumulado / reposicao) * 100)}% da reposição`
                : ""}
            </p>
          </div>
        )}
        <input
          type="range"
          min={0}
          max={n - 1}
          value={atual}
          aria-label={`${descricao}. Use as setas para percorrer os meses`}
          aria-valuetext={
            item
              ? `${formatarMes(item.mes)}: ${formatarMoeda(item.acumulado)} acumulado, ${formatarMoeda(item.valor)} no mês`
              : ""
          }
          onChange={(e) => setAtivo(Number(e.target.value))}
          onFocus={() => setAtivo(atual)}
          onBlur={() => setAtivo(null)}
          className="sr-only"
        />
      </div>
      <div className="relative h-4" aria-hidden>
        {meses.map((m, k) => {
          // Um rótulo a cada `cada` meses e sempre o último, sem encostar.
          const mostra =
            k === n - 1 || (k % cada === 0 && n - 1 - k >= cada / 2);
          if (!mostra) return null;
          const desloca =
            k === 0 && n > 1 ? "0%" : k === n - 1 && n > 1 ? "-100%" : "-50%";
          return (
            <span
              key={m.mes}
              className={`absolute text-[11px] whitespace-nowrap ${k === ativo ? "font-medium text-neutral-900" : "text-neutral-500"}`}
              style={{
                left: `${(x(k) / L) * 100}%`,
                transform: `translateX(${desloca})`,
              }}
            >
              {formatarMes(m.mes)}
            </span>
          );
        })}
      </div>
    </figure>
  );
}
