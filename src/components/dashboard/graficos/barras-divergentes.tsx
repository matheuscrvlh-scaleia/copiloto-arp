"use client";

import { useRef, useState } from "react";
import type { Detalhe } from "@/components/modal-detalhe";
import { ANEL_FOCO, Dica, Explorar, useDetalhes, useMontado } from "./base";

// Barras divergentes: dois lados a partir do zero (ex.: banco de horas).

export interface LinhaDivergente {
  chave: string;
  rotulo: string;
  /** Tamanho do lado negativo (sem sinal). */
  negativo: number;
  positivo: number;
  textoNegativo: string;
  textoPositivo: string;
  /** Resumo da linha, embaixo do rótulo (ex.: "saldo −32h56"). */
  resumo: string;
  detalhe?: string;
}

/**
 * Par divergente azul ↔ vermelho (polos que leem como opostos). No cartão
 * escuro de destaque valem sempre os tons para fundo escuro.
 */
const DIVERGENTE_ESCURO = { negativo: "#e66767", positivo: "#3987e5" };

/**
 * Uma linha por categoria: o lado negativo cresce para a esquerda e o
 * positivo para a direita, a partir da linha do zero. Mesma escala nos dois
 * lados; os valores ficam escritos na ponta de cada barra.
 */
export function BarrasDivergentes({
  linhas,
  rotulos,
  descricao,
  escuro = false,
  rolar = false,
  detalhes,
}: {
  linhas: LinhaDivergente[];
  rotulos: { negativo: string; positivo: string };
  descricao: string;
  /** Desenhado sobre o cartão escuro de destaque. */
  escuro?: boolean;
  /**
   * Ocupa a altura do quadro e rola as linhas por dentro (a legenda fica
   * presa embaixo). O quadro precisa ter altura definida.
   */
  rolar?: boolean;
  /** Quem forma cada item, pela chave (abre o modal ao clicar). */
  detalhes?: Record<string, Detalhe>;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  // Linha encostada no topo da rolagem: a dica abre para baixo.
  const [abaixo, setAbaixo] = useState(false);
  const lista = useRef<HTMLUListElement>(null);
  const det = useDetalhes(detalhes);
  const montado = useMontado();
  function acender(k: number | null, linha?: Element) {
    setAtivo(k);
    const topo = lista.current?.getBoundingClientRect().top;
    setAbaixo(
      rolar &&
        topo !== undefined &&
        linha !== undefined &&
        linha.getBoundingClientRect().top - topo < 80,
    );
  }
  const max = Math.max(...linhas.flatMap((l) => [l.negativo, l.positivo]), 1);
  const metade = (v: number) => (Math.max(v, 0) / max) * 100;
  const corNeg = escuro ? DIVERGENTE_ESCURO.negativo : "var(--div-negativo)";
  const corPos = escuro ? DIVERGENTE_ESCURO.positivo : "var(--div-positivo)";
  const suave = escuro ? "text-[rgb(255_255_255/0.6)]" : "text-neutral-500";
  const forte = escuro ? "text-[#fff]" : "text-neutral-900";
  const trilho = escuro
    ? "bg-[rgb(255_255_255/0.06)]"
    : "bg-neutral-900/[0.05]";
  const linhaZero = escuro ? "bg-[rgb(255_255_255/0.35)]" : "bg-neutral-900/30";

  return (
    <div className={`flex flex-col gap-4 ${rolar ? "h-full min-h-0" : ""}`}>
      <ul
        ref={lista}
        className={`relative flex flex-col gap-4 ${rolar ? "-mr-2 min-h-0 flex-1 overflow-y-auto pr-2" : ""} ${ANEL_FOCO}`}
        onPointerLeave={() => setAtivo(null)}
      >
        {linhas.map((l, k) => {
          const neg = metade(l.negativo);
          const pos = metade(l.positivo);
          const apagado = ativo !== null && ativo !== k;
          return (
            <li
              key={l.chave}
              className={`grid grid-cols-1 gap-2 transition-opacity duration-200 sm:grid-cols-[minmax(7rem,10rem)_1fr] sm:items-center sm:gap-4 ${det.tem(l.chave) ? "cursor-pointer" : ""}`}
              style={{ opacity: apagado ? 0.45 : 1 }}
              onPointerEnter={(e) => acender(k, e.currentTarget)}
              onPointerUp={() => det.abrir(l.chave)}
              onPointerDown={(e) => acender(k, e.currentTarget)}
            >
              <span className="min-w-0">
                <span className={`block truncate text-sm font-medium ${forte}`}>
                  {l.rotulo}
                </span>
                <span className={`block text-xs ${suave}`}>{l.resumo}</span>
              </span>
              <span className={`relative h-7 rounded-full ${trilho}`}>
                <span
                  aria-hidden
                  className={`absolute -inset-y-1 left-1/2 w-px ${linhaZero}`}
                />
                {/* Lado negativo: cresce do centro para a esquerda. */}
                <span
                  className="absolute inset-y-1 right-1/2 rounded-l-full motion-reduce:transition-none"
                  style={{
                    width: montado ? `${neg / 2}%` : "0%",
                    backgroundColor: corNeg,
                    transition: `width 800ms cubic-bezier(.2,.8,.2,1) ${k * 70}ms`,
                  }}
                />
                <span
                  className="absolute inset-y-1 left-1/2 rounded-r-full motion-reduce:transition-none"
                  style={{
                    width: montado ? `${pos / 2}%` : "0%",
                    backgroundColor: corPos,
                    transition: `width 800ms cubic-bezier(.2,.8,.2,1) ${k * 70}ms`,
                  }}
                />
                {/* Valores na ponta de fora; dentro da barra quando ela é longa. */}
                <span
                  className={`absolute top-1/2 -translate-y-1/2 text-xs font-semibold tabular-nums ${neg > 70 ? "text-[#fff]" : forte}`}
                  style={{
                    right:
                      neg > 70
                        ? `calc(50% + ${neg / 2}% - 4.5rem)`
                        : `calc(50% + ${neg / 2}% + 6px)`,
                  }}
                >
                  {l.textoNegativo}
                </span>
                <span
                  className={`absolute top-1/2 -translate-y-1/2 text-xs font-semibold tabular-nums ${pos > 70 ? "text-[#fff]" : forte}`}
                  style={{
                    left:
                      pos > 70
                        ? `calc(50% + ${pos / 2}% - 4.5rem)`
                        : `calc(50% + ${pos / 2}% + 6px)`,
                  }}
                >
                  {l.textoPositivo}
                </span>
                {ativo === k && (
                  <Dica
                    x={50}
                    y={abaixo ? 100 : 0}
                    abaixo={abaixo}
                    titulo={l.rotulo}
                    valor={l.resumo}
                    detalhe={l.detalhe}
                    clicavel={det.tem(l.chave)}
                  />
                )}
              </span>
            </li>
          );
        })}
        <Explorar
          itens={linhas.map((l) => ({
            rotulo: l.rotulo,
            texto: `${rotulos.negativo} ${l.textoNegativo}, ${rotulos.positivo} ${l.textoPositivo}, ${l.resumo}`,
          }))}
          ativo={ativo}
          padrao={0}
          setAtivo={(k) => {
            // Pelo teclado, a linha da vez entra na área visível.
            const linha =
              k === null ? undefined : lista.current?.children.item(k);
            if (rolar) linha?.scrollIntoView({ block: "nearest" });
            acender(k, linha ?? undefined);
          }}
          descricao={descricao}
          aoEscolher={
            det.clicavel ? (k) => det.abrir(linhas[k]?.chave) : undefined
          }
        />
      </ul>
      <div
        className={`flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs ${suave}`}
      >
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-2.5 rounded-full"
            style={{ backgroundColor: corNeg }}
          />
          ← {rotulos.negativo}
        </span>
        <span className="flex items-center gap-2">
          {rotulos.positivo} →
          <span
            aria-hidden
            className="size-2.5 rounded-full"
            style={{ backgroundColor: corPos }}
          />
        </span>
      </div>
    </div>
  );
}
