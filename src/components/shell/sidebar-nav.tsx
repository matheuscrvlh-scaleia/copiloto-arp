"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { NavSection } from "@/config/navigation";
import { ICONES } from "./icones";
import { activeHref } from "./nav-list";

const CHAVE = "menu-recolhido";

function lerRecolhidos(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Menu com seções recolhíveis. A seção da tela atual nunca fica escondida.
 * Lê o pathname: use dentro de <Suspense>.
 */
export function SidebarNav({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();
  const ativo = activeHref(sections, pathname);
  const [recolhidos, setRecolhidos] = useState<string[]>([]);

  useEffect(() => {
    setRecolhidos(lerRecolhidos());
  }, []);

  function alternar(titulo: string) {
    const novo = recolhidos.includes(titulo)
      ? recolhidos.filter((t) => t !== titulo)
      : [...recolhidos, titulo];
    setRecolhidos(novo);
    try {
      localStorage.setItem(CHAVE, JSON.stringify(novo));
    } catch {
      // Sem armazenamento: vale até recarregar.
    }
  }

  return (
    <nav className="flex flex-col gap-4 text-sm">
      {sections.map((section) => {
        const temAtivo = section.itens.some((i) => i.href === ativo);
        const aberto = temAtivo || !recolhidos.includes(section.titulo);
        const id = `menu-${section.titulo.toLowerCase()}`;
        return (
          <div key={section.titulo}>
            <button
              type="button"
              onClick={() => alternar(section.titulo)}
              aria-expanded={aberto}
              aria-controls={id}
              disabled={temAtivo}
              title={temAtivo ? "Seção da tela atual" : undefined}
              className="mb-1 flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs font-medium tracking-wider text-neutral-400 uppercase transition hover:text-neutral-700 disabled:cursor-default disabled:hover:text-neutral-400"
            >
              {section.titulo}
              <ChevronDown
                className={`size-4 transition-transform ${aberto ? "" : "-rotate-90"}`}
                aria-hidden
              />
            </button>
            {aberto && (
              <ul id={id} className="flex flex-col gap-1">
                {section.itens.map((item) => {
                  const Icone = ICONES[item.icone];
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={item.href === ativo ? "page" : undefined}
                        className="group flex items-center gap-3 rounded-full px-3 py-2.5 text-neutral-600 transition hover:bg-white/70 hover:text-neutral-900 aria-[current=page]:bg-neutral-900 aria-[current=page]:font-medium aria-[current=page]:text-white aria-[current=page]:shadow-lg aria-[current=page]:shadow-black/10"
                      >
                        <Icone
                          className="size-[18px] shrink-0 opacity-80 group-aria-[current=page]:opacity-100"
                          aria-hidden
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
