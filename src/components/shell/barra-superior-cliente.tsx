"use client";

import { CalendarDays, CornerDownLeft, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { type NavSection, ondeEstou } from "@/config/navigation";
import { BotaoGuia } from "./guia";
import { ICONES } from "./icones";

const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Onde estou + data + busca rápida de telas (Ctrl+K). */
export function BarraSuperiorCliente({
  sections,
  hoje,
}: {
  sections: NavSection[];
  hoje: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const local = ondeEstou(sections, pathname);
  const [termo, setTermo] = useState("");
  const [aberta, setAberta] = useState(false);
  const [indice, setIndice] = useState(0);
  const campo = useRef<HTMLInputElement>(null);
  const listaId = useId();

  const resultados = useMemo(() => {
    const t = sem(termo.trim());
    const todos = sections.flatMap((s) =>
      s.itens.map((item) => ({ ...item, secao: s.titulo })),
    );
    if (!t) return todos.slice(0, 8);
    return todos
      .filter((i) => sem(`${i.secao} ${i.label}`).includes(t))
      .slice(0, 8);
  }, [termo, sections]);

  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        campo.current?.focus();
      }
    };
    document.addEventListener("keydown", atalho);
    return () => document.removeEventListener("keydown", atalho);
  }, []);

  function ir(href: string) {
    setTermo("");
    setAberta(false);
    campo.current?.blur();
    router.push(href);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p
        data-guia="onde-estou"
        className="flex items-center gap-2 text-sm text-neutral-500"
      >
        {local ? (
          <>
            <span>{local.secao}</span>
            <span aria-hidden>/</span>
            <span className="font-medium text-neutral-900">
              {local.item.label}
            </span>
          </>
        ) : null}
      </p>

      <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
        <BotaoGuia />
        <span className="vidro hidden items-center gap-2 rounded-full py-1.5 pr-4 pl-1.5 text-sm text-neutral-700 lg:flex">
          <span className="grid size-8 place-items-center rounded-full bg-neutral-900 text-white">
            <CalendarDays className="size-4" aria-hidden />
          </span>
          {hoje}
        </span>

        <div className="relative w-full sm:w-80">
          <label
            data-guia="busca-telas"
            className="vidro flex items-center gap-2 rounded-full py-1.5 pr-3 pl-1.5 text-sm"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-neutral-900 text-white">
              <Search className="size-4" aria-hidden />
            </span>
            <span className="sr-only">Buscar tela</span>
            <input
              ref={campo}
              value={termo}
              onChange={(e) => {
                setTermo(e.target.value);
                setIndice(0);
                setAberta(true);
              }}
              onFocus={() => setAberta(true)}
              onBlur={() => setTimeout(() => setAberta(false), 150)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setIndice((i) => Math.min(i + 1, resultados.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setIndice((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter" && resultados[indice]) {
                  ir(resultados[indice].href);
                } else if (e.key === "Escape") {
                  campo.current?.blur();
                }
              }}
              role="combobox"
              aria-expanded={aberta}
              aria-controls={listaId}
              aria-autocomplete="list"
              placeholder="Buscar tela…"
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-neutral-400"
            />
            <kbd className="hidden rounded-md border border-neutral-200 px-1.5 text-[10px] text-neutral-400 sm:block">
              Ctrl K
            </kbd>
          </label>

          {aberta && (
            <div
              id={listaId}
              role="listbox"
              className="vidro absolute top-full right-0 z-40 mt-2 w-full overflow-hidden rounded-3xl p-1.5"
            >
              {resultados.length === 0 ? (
                <p className="px-3 py-2 text-sm text-neutral-500">
                  Nenhuma tela encontrada.
                </p>
              ) : (
                resultados.map((r, i) => {
                  const Icone = ICONES[r.icone];
                  return (
                    <button
                      key={r.href}
                      type="button"
                      role="option"
                      aria-selected={i === indice}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => ir(r.href)}
                      onMouseEnter={() => setIndice(i)}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm ${i === indice ? "bg-neutral-900 text-white" : "text-neutral-700"}`}
                    >
                      <Icone className="size-4 shrink-0" aria-hidden />
                      <span className="flex-1 truncate">
                        {r.label}{" "}
                        <span className="opacity-60">· {r.secao}</span>
                      </span>
                      {i === indice && (
                        <CornerDownLeft
                          className="size-3.5 opacity-70"
                          aria-hidden
                        />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
