"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { classeCampo } from "@/components/estilos";
import { mover } from "@/lib/os/catalogo";

// Peças das listas editáveis (campos extras, checklist, ambientes, causas
// de falha): botões de subir, descer e remover, e uma lista simples de
// textos que grava como JSON num campo oculto.

const BOTAO_ICONE =
  "grid size-8 shrink-0 place-items-center rounded-full text-neutral-500 transition hover:bg-neutral-900/[0.06] hover:text-neutral-900 disabled:pointer-events-none disabled:opacity-30";

/** Subir, descer e remover um item da lista. */
export function ControlesDoItem({
  indice,
  total,
  nome,
  aoMover,
  aoRemover,
}: {
  indice: number;
  total: number;
  /** Para o leitor de tela: "Subir Placa". */
  nome: string;
  aoMover: (delta: number) => void;
  aoRemover: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center">
      <button
        type="button"
        className={BOTAO_ICONE}
        disabled={indice === 0}
        onClick={() => aoMover(-1)}
        aria-label={`Subir ${nome}`}
        title="Subir"
      >
        <ArrowUp className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        className={BOTAO_ICONE}
        disabled={indice === total - 1}
        onClick={() => aoMover(1)}
        aria-label={`Descer ${nome}`}
        title="Descer"
      >
        <ArrowDown className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        className={`${BOTAO_ICONE} hover:bg-red-50 hover:text-red-700`}
        onClick={aoRemover}
        aria-label={`Remover ${nome}`}
        title="Remover"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export function BotaoAdicionar({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex w-fit items-center gap-1.5 rounded-full border border-dashed border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-900"
    >
      <Plus className="size-3.5" aria-hidden />
      {children}
    </button>
  );
}

/** Identificador local para as chaves do React (a lista muda de ordem). */
export function useIds() {
  const n = useRef(0);
  return () => `i${++n.current}`;
}

/**
 * Lista de textos ordenável (ambientes da vistoria, causas de falha). Grava
 * no campo oculto `name` como JSON; o servidor limpa vazios e repetidos.
 */
export function ListaDeTextos({
  name,
  inicial,
  rotuloItem,
  placeholder,
}: {
  name: string;
  inicial: string[];
  /** "ambiente", "causa": usado nos botões e no leitor de tela. */
  rotuloItem: string;
  placeholder?: string;
}) {
  const novoId = useIds();
  const [itens, setItens] = useState(() =>
    inicial.map((texto) => ({ id: novoId(), texto })),
  );
  const [novo, setNovo] = useState("");
  const adicionar = () => {
    const t = novo.trim();
    if (!t) return;
    setItens((l) => [...l, { id: novoId(), texto: t }]);
    setNovo("");
  };
  return (
    <div className="flex flex-col gap-2">
      <input
        type="hidden"
        name={name}
        value={JSON.stringify(itens.map((i) => i.texto))}
      />
      {itens.length === 0 && (
        <p className="text-xs text-neutral-500">Nenhum item na lista.</p>
      )}
      <ol className="flex flex-col gap-1.5">
        {itens.map((item, i) => (
          <li key={item.id} className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-right text-xs text-neutral-400 tabular-nums">
              {i + 1}
            </span>
            <input
              value={item.texto}
              onChange={(e) =>
                setItens((l) =>
                  l.map((x) =>
                    x.id === item.id ? { ...x, texto: e.target.value } : x,
                  ),
                )
              }
              aria-label={`${rotuloItem} ${i + 1}`}
              maxLength={120}
              className={classeCampo}
            />
            <ControlesDoItem
              indice={i}
              total={itens.length}
              nome={item.texto || `${rotuloItem} ${i + 1}`}
              aoMover={(d) => setItens((l) => mover(l, i, d))}
              aoRemover={() =>
                setItens((l) => l.filter((x) => x.id !== item.id))
              }
            />
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-2 pl-8">
        <input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              adicionar();
            }
          }}
          placeholder={placeholder ?? `Novo ${rotuloItem}`}
          aria-label={`Novo ${rotuloItem}`}
          maxLength={120}
          className={classeCampo}
        />
        <button
          type="button"
          onClick={adicionar}
          className="shrink-0 rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 transition hover:border-neutral-400"
        >
          Incluir
        </button>
      </div>
    </div>
  );
}
