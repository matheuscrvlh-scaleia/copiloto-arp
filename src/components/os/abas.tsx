"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Abas de uma tela de Tickets (Operações, Portal e agenda): a ativa fica
// escura, as outras em vidro.

export interface Aba {
  href: string;
  rotulo: string;
}

export function Abas({ abas, rotulo }: { abas: Aba[]; rotulo: string }) {
  const atual = usePathname();
  // A aba mais específica que casa com o endereço (as outras são prefixo dela).
  const ativa = [...abas]
    .sort((a, b) => b.href.length - a.href.length)
    .find((a) => atual === a.href || atual.startsWith(`${a.href}/`))?.href;
  return (
    <nav
      aria-label={rotulo}
      className="vidro flex w-full gap-1 overflow-x-auto rounded-full p-1 sm:w-fit"
    >
      {abas.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          aria-current={a.href === ativa ? "page" : undefined}
          className="shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-white/60 hover:text-neutral-900 aria-[current=page]:bg-neutral-900 aria-[current=page]:text-white aria-[current=page]:shadow-sm"
        >
          {a.rotulo}
        </Link>
      ))}
    </nav>
  );
}
