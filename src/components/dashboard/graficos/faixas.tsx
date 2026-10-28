"use client";

import { useState } from "react";
import type { Detalhe } from "@/components/modal-detalhe";
import {
  ANEL_FOCO,
  Dica,
  Explorar,
  type ItemGrafico,
  parteDe,
  useDetalhes,
  useMontado,
  usePreCarga,
} from "./base";

// Faixas: distribuição de um total em poucas faixas.

/**
 * Colunas largas, uma por faixa (ex.: tempo de casa), com a quantidade e a
 * parte do total escritas em cima de cada uma. Sem trilho de fundo: ele parecia
 * uma segunda coluna, todas da mesma altura.
 */
export function Faixas({
  itens,
  descricao,
  className = "",
  detalhes,
}: {
  itens: ItemGrafico[];
  descricao: string;
  className?: string;
  /** Quem forma cada item, pela chave (abre o modal ao clicar). */
  detalhes?: Record<string, Detalhe>;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const det = useDetalhes(detalhes);
  usePreCarga(detalhes, ativo === null ? undefined : itens[ativo]?.chave);
  const montado = useMontado();
  const total = itens.reduce((s, i) => s + Math.max(i.valor, 0), 0);
  const max = Math.max(...itens.map((i) => i.valor), 0);
  // Até 72% do trilho: sobra espaço para o número em cima da maior.
  const altura = (v: number) => (max > 0 ? Math.max((v / max) * 72, 1.5) : 1.5);

  return (
    <div className={`flex min-h-64 flex-col gap-3 ${className}`}>
      <div
        className={`relative flex flex-1 gap-2 sm:gap-3 ${ANEL_FOCO}`}
        onPointerLeave={() => setAtivo(null)}
      >
        {itens.map((i, k) => {
          const h = altura(i.valor);
          const aceso = ativo === k;
          const apagado = ativo !== null && !aceso;
          return (
            <div
              key={i.chave}
              className={`relative flex-1 rounded-2xl transition duration-200 ${aceso ? "bg-neutral-900/[0.05]" : ""} ${det.tem(i.chave) ? "cursor-pointer" : ""}`}
              style={{ opacity: apagado ? 0.45 : 1 }}
              onPointerEnter={() => setAtivo(k)}
              onPointerUp={() => det.abrir(i.chave)}
              onPointerDown={() => setAtivo(k)}
            >
              <span
                className={`absolute inset-x-0 bottom-0 rounded-2xl motion-reduce:transition-none ${aceso ? "bg-neutral-900" : "bg-neutral-900/80"}`}
                style={{
                  height: montado ? `${h}%` : "0%",
                  transition: `height 700ms cubic-bezier(.2,.8,.2,1) ${k * 50}ms, background-color 200ms`,
                }}
              />
              {!aceso && (
                <span
                  className="absolute inset-x-0 text-center transition-opacity duration-500"
                  style={{
                    bottom: `calc(${h}% + 8px)`,
                    opacity: montado ? 1 : 0,
                  }}
                >
                  <span className="block text-2xl leading-none font-semibold tracking-tight tabular-nums text-neutral-900">
                    {i.texto}
                  </span>
                  <span className="mt-1 block text-xs tabular-nums text-neutral-500">
                    {parteDe(i.valor, total)}
                  </span>
                </span>
              )}
              {aceso && (
                <Dica
                  x={50}
                  y={100 - h}
                  titulo={i.titulo ?? i.rotulo}
                  valor={i.texto}
                  detalhe={i.detalhe}
                  clicavel={det.tem(i.chave)}
                />
              )}
            </div>
          );
        })}
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
      <div className="flex gap-2 sm:gap-3" aria-hidden>
        {itens.map((i, k) => (
          <span
            key={i.chave}
            className={`flex-1 truncate text-center text-xs ${k === ativo ? "font-medium text-neutral-900" : "text-neutral-600"}`}
          >
            {i.rotulo}
          </span>
        ))}
      </div>
    </div>
  );
}
