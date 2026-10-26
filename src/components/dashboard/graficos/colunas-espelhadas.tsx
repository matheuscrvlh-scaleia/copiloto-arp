"use client";

import { useState } from "react";
import type { Detalhe } from "@/components/modal-detalhe";
import {
  ANEL_FOCO,
  Dica,
  Explorar,
  useDetalhes,
  useMontado,
  usePreCarga,
} from "./base";

// Colunas espelhadas: entradas para cima, saídas para baixo.

export interface ParMensal {
  chave: string;
  rotulo: string;
  titulo: string;
  acima: number;
  abaixo: number;
  destaque?: boolean;
}

/**
 * Duas séries opostas no mesmo mês (ex.: admissões ↑ e desligamentos ↓) a
 * partir de uma linha base. Legenda sempre visível (são duas séries) e o
 * número escrito na ponta de cada coluna.
 */
export function ColunasEspelhadas({
  itens,
  rotulos,
  descricao,
  detalhes,
  preencher = false,
  barrasLargas = false,
}: {
  itens: ParMensal[];
  rotulos: { acima: string; abaixo: string };
  descricao: string;
  /** Quem forma cada item, pela chave (abre o modal ao clicar). */
  detalhes?: Record<string, Detalhe>;
  /**
   * Ocupa a altura que sobra no quadro (o pai é uma coluna flex), nunca
   * menos que a altura de sempre. Sem ela, a altura é fixa.
   */
  preencher?: boolean;
  /**
   * Colunas mais largas com poucos itens: acompanham o espaço de cada item
   * (até 3,5rem) e nunca ficam mais finas que as de sempre.
   */
  barrasLargas?: boolean;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const det = useDetalhes(detalhes);
  usePreCarga(detalhes, ativo === null ? undefined : itens[ativo]?.chave);
  const montado = useMontado();
  const max = Math.max(...itens.flatMap((i) => [i.acima, i.abaixo]), 1);
  const alt = (v: number) => (v / max) * 82;
  const destaque = itens.findIndex((i) => i.destaque);
  const item = ativo === null ? undefined : itens[ativo];
  const barra = barrasLargas
    ? {
        largura: "min(100%, max(1.25rem, min(55%, 3.5rem)))",
        cima: "rounded-t-lg",
        baixo: "rounded-b-lg",
        fundo: "rounded-2xl",
      }
    : {
        largura: undefined,
        cima: "w-full max-w-5 rounded-t-full",
        baixo: "w-full max-w-5 rounded-b-full",
        fundo: "rounded-full",
      };

  return (
    <div className={`flex flex-col gap-3 ${preencher ? "min-h-0 flex-1" : ""}`}>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-2.5 rounded-full"
            style={{ backgroundColor: "var(--serie-1)" }}
          />
          {rotulos.acima} ↑
        </span>
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-2.5 rounded-full"
            style={{ backgroundColor: "var(--serie-2)" }}
          />
          {rotulos.abaixo} ↓
        </span>
      </div>
      <div
        className={`relative ${ANEL_FOCO} ${preencher ? "flex min-h-52 flex-1 flex-col" : ""}`}
        onPointerLeave={() => setAtivo(null)}
      >
        <div
          className={`relative flex gap-1.5 sm:gap-2 ${preencher ? "min-h-52 flex-1" : "h-52"}`}
        >
          <span
            aria-hidden
            className="absolute inset-x-0 top-1/2 h-px bg-neutral-900/25"
          />
          {itens.map((i, k) => {
            const apagado = ativo !== null && ativo !== k;
            return (
              <div
                key={i.chave}
                className={`relative flex-1 ${barra.fundo} transition-colors ${ativo === k ? "bg-neutral-900/[0.05]" : ""} ${det.tem(i.chave) ? "cursor-pointer" : ""}`}
                style={{ opacity: apagado ? 0.45 : 1 }}
                onPointerEnter={() => setAtivo(k)}
                onPointerUp={() => det.abrir(i.chave)}
                onPointerDown={() => setAtivo(k)}
              >
                {/* Para cima e para baixo a partir da linha base. */}
                <span
                  className={`absolute bottom-1/2 left-1/2 -translate-x-1/2 motion-reduce:transition-none ${barra.cima}`}
                  style={{
                    width: barra.largura,
                    height: montado ? `${alt(i.acima) / 2}%` : "0%",
                    backgroundColor: "var(--serie-1)",
                    transition: `height 700ms cubic-bezier(.2,.8,.2,1) ${k * 35}ms`,
                  }}
                />
                <span
                  className={`absolute top-1/2 left-1/2 -translate-x-1/2 motion-reduce:transition-none ${barra.baixo}`}
                  style={{
                    width: barra.largura,
                    height: montado ? `${alt(i.abaixo) / 2}%` : "0%",
                    backgroundColor: "var(--serie-2)",
                    transition: `height 700ms cubic-bezier(.2,.8,.2,1) ${k * 35}ms`,
                  }}
                />
                {i.acima > 0 && (
                  <span
                    className="absolute left-1/2 -translate-x-1/2 text-[11px] font-medium tabular-nums text-neutral-700"
                    style={{ bottom: `calc(50% + ${alt(i.acima) / 2}% + 2px)` }}
                  >
                    {i.acima}
                  </span>
                )}
                {i.abaixo > 0 && (
                  <span
                    className="absolute left-1/2 -translate-x-1/2 text-[11px] font-medium tabular-nums text-neutral-700"
                    style={{ top: `calc(50% + ${alt(i.abaixo) / 2}% + 2px)` }}
                  >
                    {i.abaixo}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {item && ativo !== null && (
          <Dica
            x={((ativo + 0.5) / itens.length) * 100}
            y={50 - alt(item.acima) / 2}
            titulo={item.titulo}
            clicavel={det.tem(item.chave)}
            valor={`+${item.acima} / −${item.abaixo}`}
            detalhe={`${item.acima} ${rotulos.acima.toLowerCase()} · ${item.abaixo} ${rotulos.abaixo.toLowerCase()}`}
          />
        )}
        <Explorar
          itens={itens.map((i) => ({
            rotulo: i.titulo,
            texto: `${i.acima} ${rotulos.acima.toLowerCase()}, ${i.abaixo} ${rotulos.abaixo.toLowerCase()}`,
          }))}
          ativo={ativo}
          padrao={destaque >= 0 ? destaque : itens.length - 1}
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
