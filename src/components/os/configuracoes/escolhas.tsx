"use client";

import { Check, ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { GRUPOS_DE_ICONES, SeloIcone } from "./icones";

// Escolha de ícone e de cor dos setores e categorias. Gravam em campos do
// formulário com o "name" dado (radios nativos: setas do teclado andam
// entre as opções).

/** Cores sugeridas: as dos setores de partida e alguns tons a mais. */
export const CORES_SUGERIDAS = [
  "#2a78d6",
  "#0ea5e9",
  "#1baf7a",
  "#0ca30c",
  "#eda100",
  "#eb6834",
  "#dc2626",
  "#e87ba4",
  "#7c5cd6",
  "#525252",
];

export function EscolhaIcone({
  name,
  valorInicial,
  cor,
  aoMudar,
}: {
  name: string;
  valorInicial: string;
  /** Cor da prévia (a do setor ou da categoria). */
  cor: string;
  aoMudar?: (nome: string) => void;
}) {
  const [atual, setAtual] = useState(valorInicial);
  const [aberto, setAberto] = useState(false);
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <SeloIcone nome={atual} cor={cor} />
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          aria-expanded={aberto}
          aria-controls={id}
          className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:border-neutral-400"
        >
          {aberto ? "Fechar a lista" : "Trocar ícone"}
          <ChevronDown
            className={`size-3.5 transition ${aberto ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
      </div>
      {/* Os radios ficam no formulário mesmo com a lista fechada. */}
      <fieldset
        id={id}
        className={`m-0 flex-col gap-3 rounded-2xl border border-neutral-200 bg-white/70 p-3 ${aberto ? "flex" : "hidden"}`}
      >
        <legend className="sr-only">Ícone</legend>
        {GRUPOS_DE_ICONES.map((g) => (
          <div key={g.grupo}>
            <p className="mb-1.5 text-[11px] font-medium tracking-wide text-neutral-500 uppercase">
              {g.grupo}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(g.icones).map(([nome, Icone]) => (
                <label
                  key={nome}
                  title={nome}
                  className="relative grid size-10 cursor-pointer place-items-center rounded-xl border border-transparent text-neutral-700 transition hover:bg-neutral-900/[0.05] has-[:checked]:border-neutral-900 has-[:checked]:bg-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-neutral-900/30"
                >
                  <input
                    type="radio"
                    name={name}
                    value={nome}
                    checked={atual === nome}
                    onChange={() => {
                      setAtual(nome);
                      aoMudar?.(nome);
                    }}
                    className="sr-only"
                  />
                  <Icone className="size-5" aria-hidden />
                  <span className="sr-only">{nome}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </fieldset>
    </div>
  );
}

export function EscolhaCor({
  name,
  valorInicial,
  aoMudar,
  opcional = false,
}: {
  name: string;
  valorInicial: string;
  aoMudar?: (cor: string) => void;
  /** Permite "sem cor própria" (a categoria usa a do setor). */
  opcional?: boolean;
}) {
  const [atual, setAtual] = useState(valorInicial);
  const trocar = (cor: string) => {
    setAtual(cor);
    aoMudar?.(cor);
  };
  return (
    <fieldset className="m-0 flex flex-wrap items-center gap-1.5 p-0">
      <legend className="sr-only">Cor</legend>
      <input type="hidden" name={name} value={atual} />
      {opcional && (
        <button
          type="button"
          onClick={() => trocar("")}
          aria-pressed={atual === ""}
          className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:border-neutral-400 aria-pressed:border-neutral-900"
        >
          Cor do setor
        </button>
      )}
      {CORES_SUGERIDAS.map((cor) => (
        <button
          key={cor}
          type="button"
          onClick={() => trocar(cor)}
          aria-pressed={atual.toLowerCase() === cor}
          aria-label={`Cor ${cor}`}
          className="grid size-8 place-items-center rounded-full ring-offset-2 transition hover:scale-110 focus-visible:ring-2 focus-visible:ring-neutral-900/40 aria-pressed:ring-2 aria-pressed:ring-neutral-900"
          style={{ backgroundColor: cor }}
        >
          {atual.toLowerCase() === cor && (
            <Check className="size-4 text-white" aria-hidden />
          )}
        </button>
      ))}
      <label className="ml-1 flex items-center gap-1.5 text-xs text-neutral-500">
        Outra
        <input
          type="color"
          value={atual || "#525252"}
          onChange={(e) => trocar(e.target.value)}
          className="size-8 cursor-pointer rounded-full border border-neutral-200 bg-white p-0.5"
        />
      </label>
    </fieldset>
  );
}
