"use client";

import { Building2, IdCard, Search, UserRound, X } from "lucide-react";
import { useId, useState } from "react";
import type { OpcoesPublico } from "@/server/calendario/base";

// Quem vê um item restrito: setores, cargos e pessoas numa lista só, com
// busca, e as escolhas em etiquetas removíveis. Grava campos repetidos
// (setores, cargos, usuarios) no formulário em volta.

type Grupo = "setores" | "cargos" | "usuarios";

const GRUPOS: { grupo: Grupo; titulo: string; Icone: typeof Building2 }[] = [
  { grupo: "setores", titulo: "Setores", Icone: Building2 },
  { grupo: "cargos", titulo: "Cargos", Icone: IdCard },
  { grupo: "usuarios", titulo: "Pessoas", Icone: UserRound },
];

const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function EscolhaDePublico({
  opcoes,
  inicial,
}: {
  opcoes: OpcoesPublico;
  inicial: Record<Grupo, string[]>;
}) {
  const [marcados, setMarcados] = useState(inicial);
  const [termo, setTermo] = useState("");
  const idBusca = useId();
  const lista: Record<Grupo, { id: string; nome: string; cor?: string }[]> = {
    setores: opcoes.setores,
    cargos: opcoes.cargos,
    usuarios: opcoes.pessoas.filter(
      (p) => p.ativo || inicial.usuarios.includes(p.id),
    ),
  };
  const nome = (g: Grupo, id: string) =>
    lista[g].find((o) => o.id === id)?.nome ?? "Removido";
  const alternar = (g: Grupo, id: string) =>
    setMarcados((m) => ({
      ...m,
      [g]: m[g].includes(id) ? m[g].filter((x) => x !== id) : [...m[g], id],
    }));
  const t = sem(termo.trim());
  const total = GRUPOS.reduce((s, g) => s + marcados[g.grupo].length, 0);

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white/60 p-3">
      {GRUPOS.flatMap(({ grupo }) =>
        marcados[grupo].map((id) => (
          <input key={`${grupo}:${id}`} type="hidden" name={grupo} value={id} />
        )),
      )}
      {total > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Quem vê">
          {GRUPOS.flatMap(({ grupo, Icone }) =>
            marcados[grupo].map((id) => (
              <li
                key={`${grupo}:${id}`}
                className="inline-flex items-center gap-1 rounded-full bg-neutral-900/[0.06] py-1 pr-1 pl-2.5 text-xs font-medium"
              >
                <Icone aria-hidden className="size-3 text-neutral-500" />
                {nome(grupo, id)}
                <button
                  type="button"
                  onClick={() => alternar(grupo, id)}
                  aria-label={`Tirar ${nome(grupo, id)}`}
                  className="grid size-5 place-items-center rounded-full text-neutral-500 hover:bg-neutral-900/10 hover:text-neutral-900"
                >
                  <X aria-hidden className="size-3" />
                </button>
              </li>
            )),
          )}
        </ul>
      ) : (
        <p className="text-xs text-neutral-500">
          Escolha ao menos um setor, cargo ou pessoa.
        </p>
      )}
      <label htmlFor={idBusca} className="sr-only">
        Buscar setor, cargo ou pessoa
      </label>
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400"
        />
        <input
          id={idBusca}
          type="search"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
          placeholder="Buscar setor, cargo ou pessoa"
          className="w-full rounded-xl border border-neutral-200 bg-white py-2 pr-3 pl-9 text-sm outline-none focus:border-neutral-900"
        />
      </div>
      <div className="max-h-52 overflow-y-auto pr-1">
        {GRUPOS.map(({ grupo, titulo, Icone }) => {
          const itens = lista[grupo].filter(
            (o) => !t || sem(o.nome).includes(t),
          );
          if (!itens.length) return null;
          return (
            <fieldset key={grupo} className="m-0 mb-2 border-0 p-0">
              <legend className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-medium tracking-wide text-neutral-500 uppercase">
                <Icone aria-hidden className="size-3" />
                {titulo}
              </legend>
              <div className="grid gap-0.5 sm:grid-cols-2">
                {itens.map((o) => (
                  <label
                    key={o.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-neutral-900/[0.04]"
                  >
                    <input
                      type="checkbox"
                      checked={marcados[grupo].includes(o.id)}
                      onChange={() => alternar(grupo, o.id)}
                      className="size-4 accent-neutral-900"
                    />
                    {o.cor && (
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: o.cor }}
                      />
                    )}
                    <span className="truncate">{o.nome}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}
