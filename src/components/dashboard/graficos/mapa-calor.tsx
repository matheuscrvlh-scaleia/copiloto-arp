"use client";

import { useState } from "react";
import { formatar, type Unidade } from "./series";

// Mapa de calor: linhas × colunas (ex.: dia da semana × hora; locatário ×
// tema). Uma cor só, do claro ao escuro (sequencial), 2px de folga entre as
// células e o valor exato na dica. Célula sem dado fica vazada.

export function MapaDeCalor({
  linhas,
  colunas,
  valores,
  unidade = "numero",
  descricao,
  rotuloValor,
  hrefs,
  cor = 1,
}: {
  linhas: string[];
  colunas: string[];
  /** valores[linha][coluna]; null = sem dado. */
  valores: (number | null)[][];
  unidade?: Unidade;
  descricao: string;
  /** O que o número é (ex.: "entradas em média"). */
  rotuloValor: string;
  /** Link de cada célula (ex.: avaliações daquele tema), mesma forma de `valores`. */
  hrefs?: (string | null)[][];
  /** Cor da série (1–5) da paleta. */
  cor?: 1 | 2 | 3 | 4 | 5;
}) {
  const max = Math.max(...valores.flat().map((v) => v ?? 0), 0);
  const [ativo, setAtivo] = useState<{ l: number; c: number } | null>(null);
  const v = ativo ? (valores[ativo.l]?.[ativo.c] ?? null) : null;

  return (
    <figure className="flex flex-col gap-2" aria-label={descricao}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-separate border-spacing-[2px] text-[11px]">
          <thead>
            <tr>
              <th className="sr-only">Linha</th>
              {colunas.map((c, k) => (
                <th
                  key={c}
                  scope="col"
                  className={`px-0.5 pb-1 font-normal ${ativo?.c === k ? "text-neutral-900" : "text-neutral-500"}`}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={l}>
                <th
                  scope="row"
                  className={`whitespace-nowrap pr-2 text-left font-normal ${ativo?.l === i ? "text-neutral-900" : "text-neutral-500"}`}
                >
                  {l}
                </th>
                {colunas.map((c, k) => {
                  const valor = valores[i]?.[k] ?? null;
                  const href = hrefs?.[i]?.[k] ?? null;
                  const forca = valor === null || max === 0 ? 0 : valor / max;
                  const estilo =
                    valor === null
                      ? undefined
                      : {
                          backgroundColor: `color-mix(in oklab, var(--serie-${cor}) ${Math.round(8 + forca * 88)}%, transparent)`,
                        };
                  const texto = `${l} · ${c}: ${formatar(valor, unidade)} ${rotuloValor}`;
                  const celula = (
                    <span
                      className={`block h-7 min-w-7 rounded-[4px] ${valor === null ? "border border-dashed border-neutral-900/10" : ""} ${ativo?.l === i && ativo.c === k ? "ring-2 ring-neutral-900" : ""}`}
                      style={estilo}
                    >
                      <span className="sr-only">{texto}</span>
                    </span>
                  );
                  return (
                    <td
                      key={c}
                      className="p-0"
                      onPointerEnter={() => setAtivo({ l: i, c: k })}
                      onPointerLeave={() => setAtivo(null)}
                      title={texto}
                    >
                      {href ? (
                        <a
                          href={href}
                          className="block outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/30"
                          onFocus={() => setAtivo({ l: i, c: k })}
                        >
                          {celula}
                        </a>
                      ) : (
                        celula
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
        <span className="tabular-nums" aria-live="polite">
          {ativo
            ? `${linhas[ativo.l]} · ${colunas[ativo.c]}: ${formatar(v, unidade)} ${rotuloValor}`
            : `Passe o mouse para ver o número (${rotuloValor})`}
        </span>
        <span className="flex items-center gap-1.5">
          menos
          <span
            className="h-2 w-24 rounded-full"
            style={{
              background: `linear-gradient(to right, color-mix(in oklab, var(--serie-${cor}) 8%, transparent), var(--serie-${cor}))`,
            }}
            aria-hidden
          />
          mais
        </span>
      </figcaption>
    </figure>
  );
}
