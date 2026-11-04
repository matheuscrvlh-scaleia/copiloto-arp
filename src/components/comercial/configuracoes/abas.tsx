"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface AbaConfiguracao {
  href: string;
  rotulo: string;
  descricao: string;
}

/** Abas de Comercial › Configurações: a ativa fica escura. */
export function AbasConfiguracoes({ abas }: { abas: AbaConfiguracao[] }) {
  const atual = usePathname();
  return (
    <nav
      aria-label="Seções das configurações do Comercial"
      className="vidro flex w-full gap-1 overflow-x-auto rounded-full p-1 sm:w-fit"
    >
      {abas.map((a) => {
        const ativa = atual === a.href || atual.startsWith(`${a.href}/`);
        return (
          <Link
            key={a.href}
            href={a.href}
            title={a.descricao}
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
