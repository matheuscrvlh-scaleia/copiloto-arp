"use client";

import { useId, useRef, useState } from "react";
import {
  ANEL_FOCO,
  caminhoSuave,
  Dica,
  Explorar,
  type ItemGrafico,
  useMontado,
} from "./base";

// Minigráfico de tendência (dentro dos cartões de indicador).

/** Tendência dos últimos meses, sem eixo. O cartão já mostra o valor atual. */
export function MiniArea({
  itens,
  descricao,
}: {
  itens: ItemGrafico[];
  descricao: string;
}) {
  const L = 200;
  const A = 48;
  const [ativo, setAtivo] = useState<number | null>(null);
  const montado = useMontado();
  const svg = useRef<SVGSVGElement>(null);
  const gradiente = `mini-${useId().replace(/:/g, "")}`;
  if (itens.length < 2) return null;
  const valores = itens.map((i) => i.valor);
  // Folga mínima de 25% do maior valor: variações pequenas (31 → 34) não
  // viram montanha-russa.
  const menor = Math.min(...valores);
  const maior = Math.max(...valores);
  const amplitude = Math.max(maior - menor, Math.abs(maior) * 0.25, 1);
  const min = menor - (amplitude - (maior - menor)) / 2;
  const passo = L / (itens.length - 1);
  const pts = itens.map((i, k) => ({
    x: k * passo,
    y: 6 + (1 - (i.valor - min) / amplitude) * (A - 12),
  }));
  const linha = caminhoSuave(pts);
  const area = `${linha} L ${L} ${A} L 0 ${A} Z`;
  const p = ativo === null ? pts.at(-1) : pts[ativo];
  const item = ativo === null ? undefined : itens[ativo];

  function apontar(e: React.PointerEvent) {
    const r = svg.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    const k = Math.round((((e.clientX - r.left) / r.width) * L) / passo);
    setAtivo(Math.max(0, Math.min(itens.length - 1, k)));
  }

  return (
    <div
      className={`relative -mx-1 touch-pan-y ${ANEL_FOCO}`}
      onPointerMove={apontar}
      onPointerDown={apontar}
      onPointerLeave={() => setAtivo(null)}
    >
      <svg
        ref={svg}
        viewBox={`0 0 ${L} ${A}`}
        preserveAspectRatio="none"
        className="h-12 w-full overflow-visible text-neutral-900"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradiente} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#58c069" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#58c069" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={area}
          fill={`url(#${gradiente})`}
          className="transition-opacity duration-1000"
          style={{ opacity: montado ? 1 : 0 }}
        />
        <path
          d={linha}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          pathLength={1}
          strokeDasharray="1"
          strokeDashoffset={montado ? 0 : 1}
          className="transition-[stroke-dashoffset] duration-[1200ms] ease-out motion-reduce:transition-none"
        />
      </svg>
      {p && (
        <span
          aria-hidden
          className="absolute size-2.5 rounded-full bg-marca ring-2 ring-white"
          style={{
            left: `calc(${(p.x / L) * 100}% - 5px)`,
            top: `calc(${(p.y / A) * 100}% - 5px)`,
          }}
        />
      )}
      {item && p && (
        <Dica
          x={(p.x / L) * 100}
          y={(p.y / A) * 100}
          titulo={item.titulo ?? item.rotulo}
          valor={item.texto}
        />
      )}
      <Explorar
        itens={itens}
        ativo={ativo}
        padrao={itens.length - 1}
        setAtivo={setAtivo}
        descricao={descricao}
      />
    </div>
  );
}
