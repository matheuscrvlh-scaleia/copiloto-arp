"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { classeCampo } from "@/components/estilos";

// Tabela de linhas editáveis dos Parâmetros (validade por setor, marco
// inicial, equivalências). Cada linha é um objeto; a tabela inteira vai como
// JSON num campo oculto e a ação grava só o que mudou (diferença de linhas).

type Valor = string | boolean;
type Linha = Record<string, Valor>;
type LinhaInterna = Linha & { __chave: string };

export interface ColunaEditavel {
  chave: string;
  rotulo: string;
  tipo: "texto" | "numero" | "select" | "check";
  opcoes?: { valor: string; rotulo: string }[];
  /** Largura da coluna (classe), ex.: "w-28". */
  largura?: string;
  placeholder?: string;
  max?: number;
}

let sequencia = 0;
const novaChave = () => `linha-${++sequencia}`;

export function TabelaEditavel({
  name,
  colunas,
  inicial,
  novaLinha,
  rotuloDoItem,
  vazio,
}: {
  /** Nome do campo oculto (JSON das linhas). */
  name: string;
  colunas: ColunaEditavel[];
  inicial: Linha[];
  /** Valores de uma linha nova. */
  novaLinha: Linha;
  /** "setor", "marco": para os botões e o leitor de tela. */
  rotuloDoItem: string;
  vazio: string;
}) {
  const [linhas, setLinhas] = useState<LinhaInterna[]>(() =>
    inicial.map((l) => ({ ...l, __chave: novaChave() })),
  );
  const mudar = (chave: string, campo: string, v: Valor) =>
    setLinhas((l) =>
      l.map((x) => (x.__chave === chave ? { ...x, [campo]: v } : x)),
    );
  const limpas = linhas.map(({ __chave, ...resto }) => resto);

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name={name} value={JSON.stringify(limpas)} />
      {linhas.length === 0 ? (
        <p className="text-sm text-neutral-500">{vazio}</p>
      ) : (
        <div className="relative -mx-2 overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                {colunas.map((c) => (
                  <th key={c.chave} className="px-2 py-2 font-medium">
                    {c.rotulo}
                  </th>
                ))}
                <th className="w-10 px-2 py-2">
                  <span className="sr-only">Remover</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr
                  key={l.__chave}
                  className="border-b border-neutral-900/[0.06] last:border-0"
                >
                  {colunas.map((c) => (
                    <td
                      key={c.chave}
                      className={`px-2 py-1.5 ${c.largura ?? ""}`}
                    >
                      <Celula
                        coluna={c}
                        valor={l[c.chave]}
                        rotulo={`${c.rotulo} (${rotuloDoItem} ${i + 1})`}
                        aoMudar={(v) => mudar(l.__chave, c.chave, v)}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setLinhas((x) =>
                          x.filter((y) => y.__chave !== l.__chave),
                        )
                      }
                      aria-label={`Remover ${rotuloDoItem} ${i + 1}`}
                      title="Remover"
                      className="grid size-8 place-items-center rounded-full text-neutral-500 transition hover:bg-red-50 hover:text-red-700"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button
        type="button"
        onClick={() =>
          setLinhas((l) => [...l, { ...novaLinha, __chave: novaChave() }])
        }
        className="inline-flex w-fit items-center gap-1.5 rounded-full border border-dashed border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-900"
      >
        <Plus className="size-3.5" aria-hidden />
        Incluir {rotuloDoItem}
      </button>
    </div>
  );
}

function Celula({
  coluna,
  valor,
  rotulo,
  aoMudar,
}: {
  coluna: ColunaEditavel;
  valor: Valor | undefined;
  rotulo: string;
  aoMudar: (v: Valor) => void;
}) {
  if (coluna.tipo === "check")
    return (
      <input
        type="checkbox"
        aria-label={rotulo}
        checked={valor === true}
        onChange={(e) => aoMudar(e.target.checked)}
        className="size-4 accent-neutral-900"
      />
    );
  if (coluna.tipo === "select")
    return (
      <select
        aria-label={rotulo}
        value={String(valor ?? "")}
        onChange={(e) => aoMudar(e.target.value)}
        className={classeCampo}
      >
        {!coluna.opcoes?.some((o) => o.valor === valor) && (
          <option value="">Escolha…</option>
        )}
        {coluna.opcoes?.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    );
  return (
    <input
      aria-label={rotulo}
      value={String(valor ?? "")}
      onChange={(e) => aoMudar(e.target.value)}
      inputMode={coluna.tipo === "numero" ? "decimal" : undefined}
      placeholder={coluna.placeholder}
      maxLength={coluna.max ?? 120}
      required
      className={`${classeCampo} ${coluna.tipo === "numero" ? "text-right tabular-nums" : ""}`}
    />
  );
}
