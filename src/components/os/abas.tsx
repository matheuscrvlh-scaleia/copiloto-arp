"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Abas de uma tela de Tickets (Operações, Portal lojista): a ativa fica
// escura, as outras em vidro.

export interface Aba {
  href: string;
  rotulo: string;
}

export function Abas({ abas, rotulo }: { abas: Aba[]; rotulo: string }) {
  const atual = usePathname();
  // A aba mais específica que casa com o endereço (as outras são prefixo
  // dela). O href pode levar filtros (?ano=…), que não contam aqui.
  const caminho = (href: string) => href.split("?")[0] ?? href;
  const ativa = [...abas]
    .sort((a, b) => caminho(b.href).length - caminho(a.href).length)
    .find(
      (a) =>
        atual === caminho(a.href) || atual.startsWith(`${caminho(a.href)}/`),
    )?.href;
  return (
    <nav
      aria-label={rotulo}
      data-guia="abas"
      className="vidro flex w-full gap-1 overflow-x-auto rounded-full p-1 sm:w-fit"
    >
      {abas.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          data-guia="aba"
          data-guia-titulo={a.rotulo}
          aria-current={a.href === ativa ? "page" : undefined}
          className="shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-white/60 hover:text-neutral-900 aria-[current=page]:bg-neutral-900 aria-[current=page]:text-white aria-[current=page]:shadow-sm"
        >
          {a.rotulo}
        </Link>
      ))}
    </nav>
  );
}
