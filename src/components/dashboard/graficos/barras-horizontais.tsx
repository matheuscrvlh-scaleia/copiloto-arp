"use client";

import { useState } from "react";
import type { Detalhe } from "@/components/modal-detalhe";
import {
  ANEL_FOCO,
  Dica,
  Explorar,
  type ItemGrafico,
  useDetalhes,
  useMontado,
} from "./base";

// Barras deitadas.

/**
 * Barras deitadas em cápsula, uma por linha, com marcador da meta (quando
 * houver). Passar o mouse mostra o detalhe da linha.
 */
export function BarrasHorizontais({
  itens,
  vazio = "Sem dados no período.",
  meta,
  descricao = "Barras por categoria",
  rotuloLargo = false,
  detalhes,
}: {
  itens: ItemGrafico[];
  vazio?: string;
  /** Linha tracejada da meta, na mesma escala dos valores. */
  meta?: { valor: number; texto: string };
  descricao?: string;
  /** Coluna do nome mais larga (rótulos longos, ex.: cargos). */
  rotuloLargo?: boolean;
  /** Quem forma cada item, pela chave (abre o modal ao clicar). */
  detalhes?: Record<string, Detalhe>;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const det = useDetalhes(detalhes);
  const montado = useMontado();
  const max = Math.max(...itens.map((i) => i.valor), meta?.valor ?? 0, 0);
  if (itens.length === 0 || max <= 0) {
    return <p className="py-6 text-sm text-neutral-500">{vazio}</p>;
  }
  const escala = max * 1.08;
  const pct = (v: number) => (Math.max(v, 0) / escala) * 100;

  return (
    <div className={`relative ${ANEL_FOCO}`}>
      <ul className="flex flex-col gap-3" onPointerLeave={() => setAtivo(null)}>
        {itens.map((i, k) => {
          const aceso = ativo === k;
          const apagado = ativo !== null && !aceso;
          return (
            <li
              key={i.chave}
              className={`grid ${rotuloLargo ? "grid-cols-[minmax(7rem,17rem)_1fr_3.5rem]" : "grid-cols-[minmax(5rem,9rem)_1fr_4.5rem]"} items-center gap-3 transition-opacity duration-200 ${det.tem(i.chave) ? "cursor-pointer" : ""}`}
              style={{ opacity: apagado ? 0.5 : 1 }}
              onPointerEnter={() => setAtivo(k)}
              onPointerUp={() => det.abrir(i.chave)}
              onPointerDown={() => setAtivo(k)}
            >
              <span className="truncate text-sm text-neutral-600">
                {i.rotulo}
              </span>
              <span className="relative h-3.5 rounded-full bg-neutral-900/[0.06]">
                <span
                  className={`absolute inset-y-0 left-0 rounded-full motion-reduce:transition-none ${
                    i.destaque || aceso
                      ? "bg-gradient-to-r from-marca-escuro to-marca"
                      : "bg-neutral-900"
                  }`}
                  style={{
                    width: montado ? `${Math.max(pct(i.valor), 1.5)}%` : "0%",
                    transition: `width 800ms cubic-bezier(.2,.8,.2,1) ${k * 60}ms`,
                  }}
                />
                {meta && (
                  <span
                    aria-hidden
                    className="absolute -inset-y-1.5 border-l-2 border-dashed border-neutral-900/50"
                    style={{ left: `${pct(meta.valor)}%` }}
                  />
                )}
                {aceso && (
                  <Dica
                    x={Math.min(pct(i.valor), 100)}
                    y={0}
                    titulo={i.titulo ?? i.rotulo}
                    valor={i.texto}
                    detalhe={i.detalhe}
                    clicavel={det.tem(i.chave)}
                  />
                )}
              </span>
              <span className="text-right text-sm font-medium tabular-nums text-neutral-900">
                {i.texto}
              </span>
            </li>
          );
        })}
      </ul>
      {meta && (
        <p className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
          <span
            aria-hidden
            className="h-3 border-l-2 border-dashed border-neutral-900/50"
          />
          {meta.texto}
        </p>
      )}
      <Explorar
        itens={itens}
        ativo={ativo}
        padrao={0}
        setAtivo={setAtivo}
        descricao={descricao}
        aoEscolher={
          det.clicavel ? (k) => det.abrir(itens[k]?.chave) : undefined
        }
      />
    </div>
  );
}
