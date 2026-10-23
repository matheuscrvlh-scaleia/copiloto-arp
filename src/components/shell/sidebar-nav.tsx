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

function gravarRecolhidos(lista: string[]) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista));
  } catch {
    // Sem armazenamento: vale até recarregar.
  }
}

/**
 * Menu com seções recolhíveis, inclusive a da tela atual. Ao chegar numa
 * tela de uma seção recolhida (pela busca, um link), ela se abre sozinha
 * para o item marcado aparecer. Lê o pathname: use dentro de <Suspense>.
 */
export function SidebarNav({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();
  const ativo = activeHref(sections, pathname);
  const secaoAtiva = sections.find((s) =>
    s.itens.some((i) => i.href === ativo),
  )?.titulo;
  const [recolhidos, setRecolhidos] = useState<string[]>([]);

  useEffect(() => {
    setRecolhidos(lerRecolhidos());
  }, []);

  // Mudou de tela (o item ativo mudou) para dentro de uma seção recolhida:
  // abre a seção. Recolher a seção sem sair da tela continua valendo.
  useEffect(() => {
    if (!secaoAtiva || !ativo) return;
    setRecolhidos((atual) => {
      if (!atual.includes(secaoAtiva)) return atual;
      const novo = atual.filter((t) => t !== secaoAtiva);
      gravarRecolhidos(novo);
      return novo;
    });
  }, [secaoAtiva, ativo]);

  function alternar(titulo: string) {
    const novo = recolhidos.includes(titulo)
      ? recolhidos.filter((t) => t !== titulo)
      : [...recolhidos, titulo];
    setRecolhidos(novo);
    gravarRecolhidos(novo);
  }

  return (
    <nav className="flex flex-col gap-4 text-sm">
      {sections.map((section) => {
        const aberto = !recolhidos.includes(section.titulo);
        const id = `menu-${section.titulo.toLowerCase()}`;
        return (
          <div key={section.titulo}>
            <button
              type="button"
              onClick={() => alternar(section.titulo)}
              aria-expanded={aberto}
              aria-controls={id}
              className="mb-1 flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs font-medium tracking-wider text-neutral-400 uppercase transition hover:text-neutral-700"
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
