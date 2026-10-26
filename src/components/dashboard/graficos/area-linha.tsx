"use client";

import { useId, useRef, useState } from "react";
import type { Detalhe } from "@/components/modal-detalhe";
import { formatarNumero } from "@/lib/formato";
import {
  ANEL_FOCO,
  caminhoSuave,
  Dica,
  Explorar,
  type ItemGrafico,
  tetoRedondo,
  useDetalhes,
  useMontado,
} from "./base";

// Área ao longo do tempo.

/**
 * Área suave com o eixo partindo do zero. Mira vertical e dica seguem o
 * mouse; a dica mostra a variação contra o ponto anterior.
 */
export function AreaLinha({
  itens,
  descricao,
  className = "",
  variacao = true,
  detalhes,
}: {
  itens: ItemGrafico[];
  descricao: string;
  className?: string;
  /** Mostra "+1 vs set" na dica. */
  variacao?: boolean;
  /** Quem forma cada item, pela chave (abre o modal ao clicar). */
  detalhes?: Record<string, Detalhe>;
}) {
  const L = 600;
  const A = 190;
  const margem = { x: 14, topo: 22, base: 4 };
  const teto = tetoRedondo(Math.max(...itens.map((i) => i.valor), 0));
  const util = A - margem.topo - margem.base;
  const y = (v: number) => margem.topo + (1 - Math.max(v, 0) / teto) * util;
  const passo = itens.length > 1 ? (L - margem.x * 2) / (itens.length - 1) : 0;
  const pts = itens.map((i, k) => ({ x: margem.x + k * passo, y: y(i.valor) }));
  const linha = caminhoSuave(pts);
  const ultimo = pts.at(-1);
  const primeiro = pts[0];
  const chao = y(0);
  const area =
    ultimo && primeiro
      ? `${linha} L ${ultimo.x} ${chao} L ${primeiro.x} ${chao} Z`
      : "";
  const destaque = itens.findIndex((i) => i.destaque);
  const padrao = destaque >= 0 ? destaque : itens.length - 1;

  const [ativo, setAtivo] = useState<number | null>(null);
  const det = useDetalhes(detalhes);
  const montado = useMontado();
  const svg = useRef<SVGSVGElement>(null);
  const gradiente = `area-${useId().replace(/:/g, "")}`;

  function apontar(e: React.PointerEvent) {
    const r = svg.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    const xv = ((e.clientX - r.left) / r.width) * L;
    const k = passo === 0 ? 0 : Math.round((xv - margem.x) / passo);
    setAtivo(Math.max(0, Math.min(itens.length - 1, k)));
  }

  const p = ativo === null ? undefined : pts[ativo];
  const item = ativo === null ? undefined : itens[ativo];
  const anterior = ativo ? itens[ativo - 1] : undefined;
  const delta = item && anterior ? item.valor - anterior.valor : null;
  const marcado = pts[padrao];

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div
        className={`relative touch-pan-y select-none ${det.clicavel ? "cursor-pointer" : ""} ${ANEL_FOCO}`}
        onPointerMove={apontar}
        onPointerUp={() =>
          det.abrir(ativo === null ? undefined : itens[ativo]?.chave)
        }
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
              <stop offset="0%" stopColor="#58c069" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#58c069" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, teto / 2, teto].map((v) => (
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
                  {formatarNumero(v)}
                </text>
              )}
            </g>
          ))}
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
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={montado ? 0 : 1}
            className="transition-[stroke-dashoffset] duration-[1400ms] ease-out motion-reduce:transition-none"
          />
          {p && (
            <line
              x1={p.x}
              x2={p.x}
              y1={margem.topo - 12}
              y2={chao}
              stroke="currentColor"
              strokeOpacity={0.3}
              strokeDasharray="3 4"
            />
          )}
          {/* Ponto marcado (mês escolhido) com anel na cor da superfície. */}
          {marcado && (
            <g
              className="transition-opacity duration-700"
              style={{ opacity: montado ? 1 : 0 }}
            >
              <circle
                cx={marcado.x}
                cy={marcado.y}
                r={7}
                className="fill-white"
              />
              <circle cx={marcado.x} cy={marcado.y} r={5} fill="#58c069" />
              {ativo === null && itens[padrao] && (
                <text
                  x={marcado.x}
                  y={marcado.y - 14}
                  textAnchor="middle"
                  className="fill-neutral-900 text-[13px] font-semibold"
                >
                  {itens[padrao].texto}
                </text>
              )}
            </g>
          )}
          {p && ativo !== padrao && (
            <g>
              <circle cx={p.x} cy={p.y} r={7} className="fill-white" />
              <circle cx={p.x} cy={p.y} r={4.5} fill="currentColor" />
            </g>
          )}
        </svg>
        {p && item && (
          <Dica
            x={(p.x / L) * 100}
            y={(p.y / A) * 100}
            titulo={item.titulo ?? item.rotulo}
            valor={item.texto}
            clicavel={det.tem(item.chave)}
            detalhe={
              variacao && delta !== null && anterior
                ? `${delta > 0 ? "+" : ""}${formatarNumero(delta)} vs ${anterior.titulo ?? anterior.rotulo}`
                : item.detalhe
            }
          />
        )}
        <Explorar
          itens={itens}
          ativo={ativo}
          padrao={padrao}
          setAtivo={setAtivo}
          descricao={descricao}
          aoEscolher={
            det.clicavel ? (k) => det.abrir(itens[k]?.chave) : undefined
          }
        />
      </div>
      <div className="flex justify-between px-1" aria-hidden>
        {itens.map((i, k) => (
          <span
            key={i.chave}
            className={`text-[11px] transition-colors ${k === ativo || (ativo === null && i.destaque) ? "font-medium text-neutral-900" : "text-neutral-500"}`}
          >
            {i.rotulo}
          </span>
        ))}
      </div>
    </div>
  );
}
