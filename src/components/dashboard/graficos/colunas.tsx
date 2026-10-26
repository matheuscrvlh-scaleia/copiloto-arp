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

// Colunas.

/**
 * Colunas em cápsula sobre um trilho translúcido. Sobem em sequência ao
 * abrir; passar o mouse acende a coluna e apaga as outras.
 */
export function Colunas({
  itens,
  descricao,
  rotularTodas = false,
  detalhes,
}: {
  itens: ItemGrafico[];
  /** Texto para leitores de tela, ex.: "Colaboradores ativos no fim de cada mês". */
  descricao: string;
  /** Valor em cima de todas as colunas (poucas colunas, ex.: faixas). */
  rotularTodas?: boolean;
  /** Quem forma cada item, pela chave (abre o modal ao clicar). */
  detalhes?: Record<string, Detalhe>;
}) {
  const max = Math.max(...itens.map((i) => i.valor), 0);
  const ultimo = itens.length - 1;
  const destaque = itens.findIndex((i) => i.destaque);
  const padrao = destaque >= 0 ? destaque : ultimo;
  const [ativo, setAtivo] = useState<number | null>(null);
  const det = useDetalhes(detalhes);
  const montado = useMontado();
  const altura = (v: number) => (max > 0 ? Math.max((v / max) * 86, 2) : 2);
  const item = ativo === null ? undefined : itens[ativo];

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`relative ${ANEL_FOCO}`}
        onPointerLeave={() => setAtivo(null)}
      >
        <div className="flex h-48 items-end gap-1.5 sm:gap-2">
          {itens.map((i, k) => {
            const h = altura(i.valor);
            const aceso = ativo === k;
            const apagado = ativo !== null && !aceso;
            const rotular =
              ativo === null && (rotularTodas || k === padrao || k === ultimo);
            return (
              <div
                key={i.chave}
                className={`relative flex h-full flex-1 justify-center ${det.tem(i.chave) ? "cursor-pointer" : ""}`}
                onPointerEnter={() => setAtivo(k)}
                onPointerUp={() => det.abrir(i.chave)}
                onPointerDown={() => setAtivo(k)}
              >
                <span className="absolute inset-y-0 w-full max-w-7 rounded-full bg-neutral-900/[0.05]" />
                <span
                  className={`absolute bottom-0 w-full max-w-7 rounded-full motion-reduce:transition-none ${
                    i.destaque
                      ? "bg-gradient-to-t from-marca-escuro to-marca"
                      : aceso
                        ? "bg-neutral-900"
                        : "bg-neutral-400/80"
                  }`}
                  style={{
                    height: montado ? `${h}%` : "0%",
                    opacity: apagado ? 0.4 : 1,
                    transition: `height 700ms cubic-bezier(.2,.8,.2,1) ${k * 35}ms, opacity 200ms, background-color 200ms`,
                  }}
                />
                {rotular && (
                  <span
                    className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium tabular-nums text-neutral-900 transition-opacity duration-500"
                    style={{
                      bottom: `calc(${h}% + 6px)`,
                      opacity: montado ? 1 : 0,
                    }}
                  >
                    {i.texto}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {item && ativo !== null && (
          <Dica
            x={((ativo + 0.5) / itens.length) * 100}
            y={100 - altura(item.valor)}
            titulo={item.titulo ?? item.rotulo}
            valor={item.texto}
            detalhe={item.detalhe}
            clicavel={det.tem(item.chave)}
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
      <div className="flex gap-1.5 sm:gap-2" aria-hidden>
        {itens.map((i, k) => (
          <span
            key={i.chave}
            className={`flex-1 truncate text-center text-[11px] ${k === ativo || i.destaque ? "font-medium text-neutral-900" : "text-neutral-500"}`}
          >
            {i.rotulo}
          </span>
        ))}
      </div>
    </div>
  );
}
