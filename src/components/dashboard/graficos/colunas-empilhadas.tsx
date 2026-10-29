"use client";

import { useState } from "react";
import {
  ANEL_FOCO,
  Dica,
  Explorar,
  eixoJusto,
  rotuloVisivel,
  useMontado,
} from "./base";
import {
  corDa,
  formatar,
  formatarEixo,
  type PontoEixo,
  type Serie,
  type Unidade,
} from "./series";

// Colunas empilhadas: o total de cada ponto (ex.: semana) dividido por
// categoria (ex.: plataforma). Cores fixas por categoria, 2px de folga entre
// os segmentos, legenda sempre visível e a dica com cada parte e o total.

export function ColunasEmpilhadas({
  pontos,
  series,
  unidade = "numero",
  descricao,
  altura = "h-56",
}: {
  pontos: PontoEixo[];
  series: Serie[];
  unidade?: Unidade;
  descricao: string;
  altura?: string;
}) {
  const totais = pontos.map((_, k) =>
    series.reduce((t, s) => t + (s.valores[k] ?? 0), 0),
  );
  const { teto, passoEixo } = eixoJusto(Math.max(...totais, 0));
  const linhasEixo = Array.from(
    { length: Math.round(teto / passoEixo) + 1 },
    (_, i) => i * passoEixo,
  );
  const [ativo, setAtivo] = useState<number | null>(null);
  const montado = useMontado();
  const ultimo = pontos.length - 1;

  const dica = ativo === null ? null : pontos[ativo];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <div
          className={`relative flex ${altura} w-12 shrink-0 flex-col-reverse justify-between text-right text-[10px] text-neutral-400`}
          aria-hidden
        >
          {linhasEixo.map((v) => (
            <span key={v} className="-my-1.5 leading-3">
              {formatarEixo(v, unidade)}
            </span>
          ))}
        </div>
        <div
          className={`relative flex-1 ${ANEL_FOCO}`}
          onPointerLeave={() => setAtivo(null)}
        >
          <div
            className={`absolute inset-0 flex flex-col-reverse justify-between`}
            aria-hidden
          >
            {linhasEixo.map((v) => (
              <span key={v} className="h-px bg-neutral-900/[0.07]" />
            ))}
          </div>
          <div className={`relative flex ${altura} items-end gap-1.5 sm:gap-2`}>
            {pontos.map((p, k) => {
              const apagado = ativo !== null && ativo !== k;
              return (
                <div
                  key={p.chave}
                  className="relative flex h-full flex-1 flex-col-reverse items-center"
                  onPointerEnter={() => setAtivo(k)}
                  onPointerDown={() => setAtivo(k)}
                >
                  {series.map((s, i) => {
                    const v = s.valores[k] ?? 0;
                    if (v <= 0) return null;
                    const topo = series
                      .slice(i + 1)
                      .every((o) => !(o.valores[k] ?? 0));
                    return (
                      <span
                        key={s.chave}
                        className={`w-full max-w-8 border-t-2 border-transparent bg-clip-padding motion-reduce:transition-none ${topo ? "rounded-t-[4px]" : ""}`}
                        style={{
                          height: montado ? `${(v / teto) * 100}%` : "0%",
                          backgroundColor: corDa(s.cor),
                          opacity: apagado ? 0.35 : 1,
                          transition: `height 650ms cubic-bezier(.2,.8,.2,1) ${k * 30}ms, opacity 200ms`,
                        }}
                      />
                    );
                  })}
                  {ativo === null && k === ultimo && (totais[k] ?? 0) > 0 && (
                    <span
                      className="absolute whitespace-nowrap text-xs font-medium tabular-nums text-neutral-900"
                      style={{
                        bottom: `calc(${((totais[k] ?? 0) / teto) * 100}% + 6px)`,
                      }}
                    >
                      {formatar(totais[k] ?? 0, unidade)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {dica && ativo !== null && (
            <Dica
              x={((ativo + 0.5) / pontos.length) * 100}
              y={100 - ((totais[ativo] ?? 0) / teto) * 100}
              titulo={dica.titulo ?? dica.rotulo}
              valor={`Total ${formatar(totais[ativo] ?? 0, unidade)}`}
              detalhe={series
                .filter((s) => (s.valores[ativo] ?? 0) > 0)
                .map(
                  (s) =>
                    `${s.rotulo}: ${formatar(s.valores[ativo] ?? 0, unidade)}`,
                )
                .join(" · ")}
            />
          )}
          <Explorar
            itens={pontos.map((p, k) => ({
              titulo: p.titulo,
              rotulo: p.rotulo,
              texto: `${formatar(totais[k] ?? 0, unidade)} (${series.map((s) => `${s.rotulo} ${formatar(s.valores[k] ?? 0, unidade)}`).join(", ")})`,
            }))}
            ativo={ativo}
            padrao={ultimo}
            setAtivo={setAtivo}
            descricao={descricao}
          />
        </div>
      </div>
      <div className="flex gap-1.5 pl-14 sm:gap-2" aria-hidden>
        {pontos.map((p, k) => (
          <span key={p.chave} className="relative h-4 flex-1">
            {rotuloVisivel(k, pontos.length, ativo) && (
              <span
                className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] ${k === ativo ? "font-medium text-neutral-900" : "text-neutral-500"}`}
              >
                {p.rotulo}
              </span>
            )}
          </span>
        ))}
      </div>
      <Legenda series={series} />
    </div>
  );
}

export function Legenda({
  series,
  extra,
}: {
  series: Pick<Serie, "chave" | "rotulo" | "cor">[];
  extra?: React.ReactNode;
}) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
      {series.map((s) => (
        <li key={s.chave} className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-full"
            style={{ backgroundColor: corDa(s.cor) }}
            aria-hidden
          />
          {s.rotulo}
        </li>
      ))}
      {extra}
    </ul>
  );
}
