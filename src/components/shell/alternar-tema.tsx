"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

/** Claro/Escuro. A escolha fica no navegador; o script do layout a aplica antes da pintura. */
export function AlternarTema() {
  const [escuro, setEscuro] = useState(false);

  useEffect(() => {
    setEscuro(document.documentElement.dataset.theme === "dark");
  }, []);

  function alternar() {
    const novo = !escuro;
    document.documentElement.dataset.theme = novo ? "dark" : "light";
    try {
      localStorage.setItem("tema", novo ? "escuro" : "claro");
    } catch {
      // Navegador sem armazenamento: vale só até recarregar.
    }
    setEscuro(novo);
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={escuro}
      aria-label="Modo escuro"
      onClick={alternar}
      className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-neutral-700 shadow-sm ring-1 ring-black/5 transition hover:text-neutral-900"
    >
      {escuro ? (
        <Moon className="size-4 shrink-0 text-violet-700" aria-hidden />
      ) : (
        <Sun className="size-4 shrink-0 text-amber-500" aria-hidden />
      )}
      <span className="flex-1 text-left">{escuro ? "Escuro" : "Claro"}</span>
      <span
        aria-hidden
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${escuro ? "bg-neutral-900" : "bg-neutral-200"}`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${escuro ? "left-[1.125rem]" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}
