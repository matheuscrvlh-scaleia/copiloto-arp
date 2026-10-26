"use client";

import { useState } from "react";
import type { Detalhe } from "@/components/modal-detalhe";
import {
  ANEL_FOCO,
  Explorar,
  parteDe,
  useDetalhes,
  useMontado,
  usePreCarga,
} from "./base";

// Rosca: composição de um total.

export interface FatiaRosca {
  chave: string;
  rotulo: string;
  valor: number;
  texto: string;
  /**
   * Posição fixa da categoria na paleta (--serie-1..5), nunca o ranking.
   * "neutro" (cinza) para o que não é categoria, como "Sem informação".
   */
  cor: 1 | 2 | 3 | 4 | 5 | "neutro";
}

/**
 * Rosca com o total no centro e a legenda ao lado. Passar o mouse numa
 * fatia ou na legenda acende as duas e mostra a parte no centro.
 */
export function Rosca({
  fatias,
  descricao,
  centro,
  vazio = "Sem dados no período.",
  detalhes,
}: {
  fatias: FatiaRosca[];
  descricao: string;
  centro: { valor: string; rotulo: string };
  vazio?: string;
  /** Quem forma cada item, pela chave (abre o modal ao clicar). */
  detalhes?: Record<string, Detalhe>;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const det = useDetalhes(detalhes);
  usePreCarga(detalhes, ativo === null ? undefined : fatias[ativo]?.chave);
  const montado = useMontado();
  const total = fatias.reduce((s, f) => s + Math.max(f.valor, 0), 0);
  if (total <= 0) {
    return <p className="py-6 text-sm text-neutral-500">{vazio}</p>;
  }
  const R = 40;
  const C = 2 * Math.PI * R;
  // 2px de superfície entre as fatias (em unidades do círculo).
  const vao = fatias.filter((f) => f.valor > 0).length > 1 ? 1.6 : 0;
  let acumulado = 0;
  const arcos = fatias.map((f) => {
    const comprimento = (Math.max(f.valor, 0) / total) * C;
    const arco = {
      tamanho: Math.max(comprimento - vao, 0),
      inicio: acumulado,
    };
    acumulado += comprimento;
    return arco;
  });
  const fatia = ativo === null ? undefined : fatias[ativo];
  const parte = (v: number) => parteDe(v, total);

  return (
    // Lado a lado só quando o quadro do gráfico tem largura (container query).
    <div className="@container">
      <div className="flex flex-col items-center gap-6 @md:flex-row">
        <div
          className={`relative size-48 shrink-0 ${ANEL_FOCO}`}
          onPointerLeave={() => setAtivo(null)}
        >
          <svg viewBox="0 0 100 100" className="-rotate-90" aria-hidden="true">
            <circle
              cx={50}
              cy={50}
              r={R}
              fill="none"
              className="stroke-neutral-900/[0.06]"
              strokeWidth={11}
            />
            {fatias.map((f, k) => {
              const a = arcos[k];
              if (!a || f.valor <= 0) return null;
              return (
                <circle
                  key={f.chave}
                  cx={50}
                  cy={50}
                  r={R}
                  fill="none"
                  stroke={`var(--serie-${f.cor})`}
                  strokeWidth={ativo === k ? 14 : 11}
                  strokeDasharray={`${montado ? a.tamanho : 0} ${C}`}
                  strokeDashoffset={-a.inicio}
                  className="cursor-pointer motion-reduce:transition-none"
                  style={{
                    opacity: ativo !== null && ativo !== k ? 0.3 : 1,
                    transition: `stroke-dasharray 900ms cubic-bezier(.2,.8,.2,1) ${k * 90}ms, stroke-width 200ms, opacity 200ms`,
                  }}
                  onPointerEnter={() => setAtivo(k)}
                  onPointerUp={() => det.abrir(f.chave)}
                  onPointerDown={() => setAtivo(k)}
                />
              );
            })}
          </svg>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="text-2xl font-semibold tracking-tight tabular-nums">
                {fatia ? fatia.texto : centro.valor}
              </p>
              <p className="max-w-28 text-xs text-neutral-500">
                {fatia
                  ? `${parte(fatia.valor)} · ${fatia.rotulo}`
                  : centro.rotulo}
              </p>
            </div>
          </div>
          <Explorar
            itens={fatias}
            ativo={ativo}
            padrao={0}
            setAtivo={setAtivo}
            descricao={descricao}
            aoEscolher={
              det.clicavel ? (k) => det.abrir(fatias[k]?.chave) : undefined
            }
          />
        </div>
        <ul className="flex w-full min-w-0 flex-col gap-1">
          {fatias.map((f, k) => (
            <li key={f.chave}>
              <button
                type="button"
                onClick={() => det.abrir(f.chave)}
                onMouseEnter={() => setAtivo(k)}
                onMouseLeave={() => setAtivo(null)}
                onFocus={() => setAtivo(k)}
                onBlur={() => setAtivo(null)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm transition ${ativo === k ? "bg-neutral-900/[0.06]" : ""} ${ativo !== null && ativo !== k ? "opacity-50" : ""}`}
              >
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: `var(--serie-${f.cor})` }}
                />
                <span className="min-w-0 flex-1 truncate text-neutral-700">
                  {f.rotulo}
                </span>
                <span className="font-medium tabular-nums">{f.texto}</span>
                <span className="w-12 text-right text-xs tabular-nums text-neutral-500">
                  {parte(f.valor)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
