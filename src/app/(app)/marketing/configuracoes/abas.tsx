"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const BASE = "/marketing/configuracoes";

const ABAS = [
  { href: BASE, rotulo: "Cadastros e regras" },
  { href: `${BASE}/integracoes`, rotulo: "Integrações" },
  { href: `${BASE}/historico`, rotulo: "Histórico" },
];

/** Subtelas das Configurações do Marketing: a ativa fica escura. */
export function AbasConfiguracoes() {
  const atual = usePathname();
  return (
    <nav
      aria-label="Seções das configurações do Marketing"
      className="vidro flex w-full gap-1 overflow-x-auto rounded-full p-1 sm:w-fit"
    >
      {ABAS.map((a) => {
        const ativa =
          a.href === BASE
            ? atual === BASE
            : atual === a.href || atual.startsWith(`${a.href}/`);
        return (
          <Link
            key={a.href}
            href={a.href}
            aria-current={ativa ? "page" : undefined}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition ${
              ativa
                ? "bg-neutral-900 text-white shadow-sm"
                : "text-neutral-600 hover:bg-white/60 hover:text-neutral-900"
            }`}
          >
            {a.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
