"use client";

import Link from "next/link";
import { useState } from "react";
import { Dica, eixoJusto, useMontado } from "./base";
import { Legenda } from "./colunas-empilhadas";
import {
  type CorSerie,
  corDa,
  formatar,
  formatarEixo,
  type Unidade,
} from "./series";

// Dispersão em quadrantes (ex.: investimento × custo por lead por
// campanha): uma bolinha por item, as medianas dividem o quadro em quatro e
// cada quadrante tem um nome. Clicar abre o item.

export interface PontoDispersao {
  chave: string;
  rotulo: string;
  x: number;
  y: number;
  cor: CorSerie;
  href?: string;
}

export function Dispersao({
  pontos,
  eixoX,
  eixoY,
  quadrantes,
  legenda,
  descricao,
}: {
  pontos: PontoDispersao[];
  eixoX: { rotulo: string; unidade: Unidade };
  eixoY: { rotulo: string; unidade: Unidade };
  /** Nome de cada quadrante: [alto-esq, alto-dir, baixo-esq, baixo-dir]. */
  quadrantes?: [string, string, string, string];
  legenda?: { chave: string; rotulo: string; cor: CorSerie }[];
  descricao: string;
}) {
  const montado = useMontado();
  const [ativo, setAtivo] = useState<string | null>(null);
  const ex = eixoJusto(Math.max(...pontos.map((p) => p.x), 0));
  const ey = eixoJusto(Math.max(...pontos.map((p) => p.y), 0));
  const mediana = (v: number[]) => {
    const s = [...v].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? (s[m] ?? 0) : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2;
  };
  const mx = mediana(pontos.map((p) => p.x));
  const my = mediana(pontos.map((p) => p.y));
  const px = (v: number) => (v / ex.teto) * 100;
  const py = (v: number) => 100 - (v / ey.teto) * 100;
  const marcasX = Array.from(
    { length: Math.round(ex.teto / ex.passoEixo) + 1 },
    (_, i) => i * ex.passoEixo,
  );
  const marcasY = Array.from(
    { length: Math.round(ey.teto / ey.passoEixo) + 1 },
    (_, i) => i * ey.passoEixo,
  );
  const atual = pontos.find((p) => p.chave === ativo);

  return (
    <figure className="flex flex-col gap-2" aria-label={descricao}>
      <div className="flex gap-2">
        <div
          className="relative h-64 w-12 shrink-0 text-right text-[10px] text-neutral-400"
          aria-hidden
        >
          {marcasY.map((v) => (
            <span
              key={v}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: `${py(v)}%` }}
            >
              {formatarEixo(v, eixoY.unidade)}
            </span>
          ))}
        </div>
        <div className="relative h-64 flex-1 rounded-xl border border-neutral-900/[0.06]">
          {marcasY.map((v) => (
            <span
              key={v}
              className="absolute inset-x-0 h-px bg-neutral-900/[0.05]"
              style={{ top: `${py(v)}%` }}
              aria-hidden
            />
          ))}
          {/* Medianas. */}
          <span
            className="absolute inset-y-0 border-l border-dashed border-neutral-900/25"
            style={{ left: `${px(mx)}%` }}
            aria-hidden
          />
          <span
            className="absolute inset-x-0 border-t border-dashed border-neutral-900/25"
            style={{ top: `${py(my)}%` }}
            aria-hidden
          />
          {quadrantes && (
            <>
              <span className="absolute left-2 top-1.5 text-[10px] font-medium text-neutral-400">
                {quadrantes[0]}
              </span>
              <span className="absolute right-2 top-1.5 text-[10px] font-medium text-neutral-400">
                {quadrantes[1]}
              </span>
              <span className="absolute bottom-1.5 left-2 text-[10px] font-medium text-neutral-400">
                {quadrantes[2]}
              </span>
              <span className="absolute bottom-1.5 right-2 text-[10px] font-medium text-neutral-400">
                {quadrantes[3]}
              </span>
            </>
          )}
          {pontos.map((p, k) => {
            const bola = (
              <span
                key="bola"
                className="block size-3.5 rounded-full ring-2 ring-white transition-transform duration-200 group-hover:scale-125 group-focus-visible:scale-125"
                style={{ backgroundColor: corDa(p.cor) }}
              />
            );
            const estilo = {
              left: `${px(p.x)}%`,
              top: `${py(p.y)}%`,
              opacity: montado ? (ativo && ativo !== p.chave ? 0.35 : 1) : 0,
              transition: `opacity 400ms ${k * 40}ms`,
            };
            const props = {
              className:
                "group absolute -translate-x-1/2 -translate-y-1/2 rounded-full p-1.5 outline-none",
              style: estilo,
              onPointerEnter: () => setAtivo(p.chave),
              onPointerLeave: () => setAtivo(null),
              onFocus: () => setAtivo(p.chave),
              onBlur: () => setAtivo(null),
              "aria-label": `${p.rotulo}: ${eixoX.rotulo} ${formatar(p.x, eixoX.unidade)}, ${eixoY.rotulo} ${formatar(p.y, eixoY.unidade)}`,
            };
            return p.href ? (
              <Link key={p.chave} href={p.href} {...props}>
                {bola}
              </Link>
            ) : (
              <button key={p.chave} type="button" {...props}>
                {bola}
              </button>
            );
          })}
          {atual && (
            <Dica
              x={px(atual.x)}
              y={py(atual.y)}
              titulo={atual.rotulo}
              valor={`${formatar(atual.y, eixoY.unidade)} ${eixoY.rotulo.toLowerCase()}`}
              detalhe={`${eixoX.rotulo}: ${formatar(atual.x, eixoX.unidade)}`}
              clicavel={Boolean(atual.href)}
            />
          )}
        </div>
      </div>
      <div
        className="relative ml-14 h-4 text-[10px] text-neutral-400"
        aria-hidden
      >
        {marcasX.map((v) => (
          <span
            key={v}
            className="absolute -translate-x-1/2"
            style={{ left: `${px(v)}%` }}
          >
            {formatarEixo(v, eixoX.unidade)}
          </span>
        ))}
      </div>
      <figcaption className="ml-14 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
        <span>
          ↔ {eixoX.rotulo} · ↕ {eixoY.rotulo} · tracejado: mediana
        </span>
        {legenda && <Legenda series={legenda} />}
      </figcaption>
    </figure>
  );
}
