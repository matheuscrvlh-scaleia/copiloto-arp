"use client";

import { Check } from "lucide-react";
import { useId } from "react";

// Escolha única em botões (tipo, resposta do ambiente, sim/não): rádios de
// verdade por baixo (setas e Tab funcionam), grandes o bastante para o dedo.

export function BotoesDeEscolha({
  nome,
  valor,
  opcoes,
  aoMudar,
  grande = false,
}: {
  /** Nome acessível do grupo. */
  nome: string;
  valor: string;
  opcoes: { valor: string; rotulo: string }[];
  aoMudar: (valor: string) => void;
  /** Botões altos (celular, primeira escolha da tela). */
  grande?: boolean;
}) {
  const grupo = useId();
  return (
    <div
      role="radiogroup"
      aria-label={nome}
      className={`grid gap-2 ${grande ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))]"}`}
    >
      {opcoes.map((o) => (
        <label key={o.valor} className="relative">
          <input
            type="radio"
            name={grupo}
            value={o.valor}
            checked={valor === o.valor}
            onChange={() => aoMudar(o.valor)}
            className="peer sr-only"
          />
          <span
            className={`flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 text-center text-sm font-medium text-neutral-700 transition select-none hover:border-neutral-400 peer-checked:border-neutral-900 peer-checked:bg-neutral-900 peer-checked:text-white peer-focus-visible:ring-4 peer-focus-visible:ring-neutral-900/15 ${grande ? "min-h-14" : "min-h-11"}`}
          >
            {valor === o.valor && <Check className="size-4" aria-hidden />}
            {o.rotulo}
          </span>
        </label>
      ))}
    </div>
  );
}
