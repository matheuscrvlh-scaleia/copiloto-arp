"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { classeCampo } from "@/components/estilos";
import type { ItemLista } from "@/lib/marketing/marca";

// Lista da marca editada um item por vez: nome e significado em campos
// próprios, sem a convenção do travessão. Vai ao servidor como JSON no
// campo "itens".

/** Como chamar o item e o que pedir no significado, por bloco. */
const ROTULOS: Record<string, { nome: string; significado: string }> = {
  tons: { nome: "Tom", significado: "Como esse tom soa e quando usar" },
  direcionadores: {
    nome: "Direcionador",
    significado: "O que isso quer dizer na prática",
  },
  atributos: { nome: "Atributo", significado: "Como a marca mostra isso" },
  valores: { nome: "Valor", significado: "O que esse valor significa" },
  personas: { nome: "Persona", significado: "Quem é, o que busca, como fala" },
  clusters: { nome: "Cluster", significado: "Quem faz parte deste grupo" },
  jornada: { nome: "Etapa", significado: "O que acontece nesta etapa" },
  brand_moments: { nome: "Momento", significado: "Como a marca aparece aqui" },
  tipografia: { nome: "Família", significado: "Onde usar" },
  logo: { nome: "Versão", significado: "Quando usar esta versão" },
};
const PADRAO = { nome: "Item", significado: "O que significa" };

interface Linha {
  id: number;
  titulo: string;
  texto: string;
}

const botaoIcone =
  "inline-flex size-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:pointer-events-none disabled:opacity-30";

export function EditorItens({
  chave,
  itens,
}: {
  chave: string;
  itens: ItemLista[];
}) {
  const rotulo = ROTULOS[chave] ?? PADRAO;
  const proximo = useRef(itens.length + 1);
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    (itens.length ? itens : [{ titulo: "" }]).map((i, k) => ({
      id: k,
      titulo: i.titulo,
      texto: i.texto ?? "",
    })),
  );
  // Item novo ganha o foco no nome.
  const [focar, setFocar] = useState<number | null>(null);
  const lista = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (focar === null) return;
    lista.current
      ?.querySelector<HTMLInputElement>(`[data-nome="${focar}"]`)
      ?.focus();
    setFocar(null);
  }, [focar]);

  const mudar = (id: number, campo: "titulo" | "texto", valor: string) =>
    setLinhas((ls) =>
      ls.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)),
    );
  const mover = (k: number, passo: -1 | 1) =>
    setLinhas((ls) => {
      const novo = [...ls];
      const [item] = novo.splice(k, 1);
      if (item) novo.splice(k + passo, 0, item);
      return novo;
    });
  const adicionar = () => {
    const id = proximo.current++;
    setLinhas((ls) => [...ls, { id, titulo: "", texto: "" }]);
    setFocar(id);
  };

  return (
    <div className="flex flex-col gap-3">
      <input
        type="hidden"
        name="itens"
        value={JSON.stringify(
          linhas.map(({ titulo, texto }) => ({ titulo, texto })),
        )}
      />
      <ol ref={lista} className="flex flex-col gap-2">
        {linhas.map((l, k) => (
          <li
            key={l.id}
            className="flex gap-3 rounded-2xl border border-neutral-200 bg-white/60 p-3"
          >
            <span className="mt-1.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-600">
              {k + 1}
            </span>
            <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-neutral-500">{rotulo.nome}</span>
                <input
                  data-nome={l.id}
                  value={l.titulo}
                  maxLength={200}
                  onChange={(e) => mudar(l.id, "titulo", e.target.value)}
                  // Enter no nome passa para o significado, não salva.
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    e.currentTarget
                      .closest("li")
                      ?.querySelector("textarea")
                      ?.focus();
                  }}
                  className={`${classeCampo} font-medium`}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-neutral-500">Significado</span>
                <textarea
                  value={l.texto}
                  maxLength={2000}
                  rows={Math.min(6, Math.max(2, l.texto.split("\n").length))}
                  placeholder={rotulo.significado}
                  onChange={(e) => mudar(l.id, "texto", e.target.value)}
                  className={`${classeCampo} font-[inherit] leading-relaxed`}
                />
              </label>
            </div>
            <div className="flex shrink-0 flex-col items-center gap-0.5 md:flex-row md:items-start md:pt-5">
              <button
                type="button"
                onClick={() => mover(k, -1)}
                disabled={k === 0}
                aria-label={`Subir ${l.titulo || `item ${k + 1}`}`}
                className={botaoIcone}
              >
                <ArrowUp className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => mover(k, 1)}
                disabled={k === linhas.length - 1}
                aria-label={`Descer ${l.titulo || `item ${k + 1}`}`}
                className={botaoIcone}
              >
                <ArrowDown className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() =>
                  setLinhas((ls) => ls.filter((x) => x.id !== l.id))
                }
                aria-label={`Remover ${l.titulo || `item ${k + 1}`}`}
                className={`${botaoIcone} hover:bg-red-50 hover:text-red-700`}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={adicionar}
        disabled={linhas.length >= 100}
        className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-600 transition hover:border-neutral-500 hover:text-neutral-900 disabled:opacity-50"
      >
        <Plus className="size-4" aria-hidden />
        Adicionar {rotulo.nome.toLowerCase()}
      </button>
    </div>
  );
}
