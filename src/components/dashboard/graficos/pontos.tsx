"use client";

import { useState } from "react";
import type { Detalhe } from "@/components/modal-detalhe";
import { formatarNumero } from "@/lib/formato";
import {
  ANEL_FOCO,
  Dica,
  Explorar,
  eixoJusto,
  type ItemGrafico,
  useDetalhes,
  useMontado,
  usePreCarga,
} from "./base";

// Pontos: distribuição de pessoas num eixo.

/**
 * Uma bolinha por pessoa no eixo do valor (enxame): mostra de uma vez onde
 * a maioria está e quem foge do padrão. A tabela da tela traz os números.
 */
export function Pontos({
  itens,
  descricao,
  meta,
  sufixo = "",
  casas = 0,
  detalhes,
}: {
  itens: ItemGrafico[];
  descricao: string;
  meta?: { valor: number; texto: string };
  /** Unidade dos rótulos do eixo (ex.: "%"). */
  sufixo?: string;
  casas?: number;
  /** Quem forma cada item, pela chave (abre o modal ao clicar). */
  detalhes?: Record<string, Detalhe>;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const det = useDetalhes(detalhes);
  const montado = useMontado();
  const ordenados = [...itens].sort((a, b) => a.valor - b.valor);
  const { teto, passoEixo } = eixoJusto(
    Math.max(...ordenados.map((i) => i.valor), meta?.valor ?? 0, 0),
  );
  const x = (v: number) => (Math.max(v, 0) / teto) * 100;

  // Faixas: cada bolinha vai para a primeira faixa (0, +1, −1, +2…) onde não
  // encosta na anterior da mesma faixa.
  const DISTANCIA = 1.6;
  // Até 5 faixas para cada lado; depois disso as bolinhas se sobrepõem
  // (a densidade aparece, e o gráfico não fica alto demais).
  const MAX_FAIXA = 5;
  const ultimaNaFaixa = new Map<number, number>();
  const ordemFaixas = Array.from({ length: MAX_FAIXA * 2 + 1 }, (_, i) =>
    i === 0 ? 0 : i % 2 ? (i + 1) / 2 : -i / 2,
  );
  const posicoes = ordenados.map((i) => {
    const px = x(i.valor);
    const faixa =
      ordemFaixas.find(
        (f) => px - (ultimaNaFaixa.get(f) ?? -Infinity) >= DISTANCIA,
      ) ??
      // Sem vaga: a faixa onde a última bolinha está mais longe.
      ordemFaixas.reduce((melhor, f) =>
        (ultimaNaFaixa.get(f) ?? 0) < (ultimaNaFaixa.get(melhor) ?? 0)
          ? f
          : melhor,
      );
    ultimaNaFaixa.set(faixa, px);
    return { px, faixa };
  });
  const faixas = Math.max(0, ...posicoes.map((p) => Math.abs(p.faixa)));
  const ALTURA_FAIXA = 12;
  const altura = (faixas * 2 + 1) * ALTURA_FAIXA + 24;
  const marcas = Array.from(
    { length: Math.round(teto / passoEixo) + 1 },
    (_, k) => k * passoEixo,
  );
  const item = ativo === null ? undefined : ordenados[ativo];
  usePreCarga(detalhes, item?.chave);
  const pos = ativo === null ? undefined : posicoes[ativo];

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`relative ${ANEL_FOCO}`}
        style={{ height: altura }}
        onPointerLeave={() => setAtivo(null)}
      >
        {marcas.map((m) => (
          <span
            key={m}
            aria-hidden
            className="absolute inset-y-0 border-l border-neutral-900/10"
            style={{ left: `${x(m)}%` }}
          />
        ))}
        {meta && (
          <span
            aria-hidden
            className="absolute inset-y-0 border-l-2 border-dashed border-neutral-900/50"
            style={{ left: `${x(meta.valor)}%` }}
          />
        )}
        {ordenados.map((i, k) => {
          const p = posicoes[k];
          if (!p) return null;
          const aceso = ativo === k;
          return (
            <span
              key={i.chave}
              aria-hidden
              className={`absolute size-3 cursor-pointer rounded-full ring-2 ring-white motion-reduce:transition-none ${aceso ? "z-10 bg-marca" : "bg-neutral-900/75"}`}
              style={{
                left: `calc(${p.px}% - 6px)`,
                top: `calc(50% - 6px + ${p.faixa * ALTURA_FAIXA}px)`,
                opacity: montado ? (ativo !== null && !aceso ? 0.35 : 1) : 0,
                transform: montado
                  ? aceso
                    ? "scale(1.5)"
                    : "scale(1)"
                  : "scale(0)",
                transition: `opacity 300ms, transform 300ms cubic-bezier(.2,.8,.2,1) ${montado && ativo === null ? `${k * 12}ms` : "0ms"}, background-color 150ms`,
              }}
              onPointerEnter={() => setAtivo(k)}
              onPointerUp={() => det.abrir(i.chave)}
              onPointerDown={() => setAtivo(k)}
            />
          );
        })}
        {item && pos && (
          <Dica
            x={pos.px}
            y={((altura / 2 + pos.faixa * ALTURA_FAIXA - 6) / altura) * 100}
            titulo={item.titulo ?? item.rotulo}
            valor={item.texto}
            detalhe={item.detalhe}
            clicavel={det.tem(item.chave)}
          />
        )}
        <Explorar
          itens={ordenados}
          ativo={ativo}
          padrao={ordenados.length - 1}
          setAtivo={setAtivo}
          descricao={descricao}
          aoEscolher={
            det.clicavel ? (k) => det.abrir(ordenados[k]?.chave) : undefined
          }
        />
      </div>
      <div className="relative h-4 text-[11px] text-neutral-500" aria-hidden>
        {marcas.map((m, k) => (
          <span
            key={m}
            className="absolute"
            style={{
              left: `${x(m)}%`,
              transform:
                k === 0
                  ? undefined
                  : k === marcas.length - 1
                    ? "translateX(-100%)"
                    : "translateX(-50%)",
            }}
          >
            {formatarNumero(m, casas)}
            {sufixo}
          </span>
        ))}
      </div>
      {meta && (
        <p className="flex items-center gap-2 text-xs text-neutral-500">
          <span
            aria-hidden
            className="h-3 border-l-2 border-dashed border-neutral-900/50"
          />
          {meta.texto}
        </p>
      )}
    </div>
  );
}
