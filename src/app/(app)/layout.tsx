import Link from "next/link";
import { Suspense } from "react";
import { Marca } from "@/components/marca";
import { BarraSuperior } from "@/components/shell/barra-superior";
import { FimPorInatividade } from "@/components/shell/fim-por-inatividade";
import { GavetaDoMenu } from "@/components/shell/gaveta-do-menu";
import { MenuDoUsuario } from "@/components/shell/menu-do-usuario";
import { NavSkeleton } from "@/components/shell/nav-list";
import { INICIO } from "@/config/navigation";

// O que não depende da pessoa (fundo, moldura, marca, esqueletos) entra no
// esqueleto estático; o menu e a barra do topo leem a sessão no <Suspense>.
// O menu é renderizado uma vez só: no computador é a coluna lateral, no
// celular abre pela gaveta.

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh p-3 md:p-5">
      <FimPorInatividade />
      {/* Brilhos coloridos atrás do vidro (globals.css). */}
      <div aria-hidden className="aurora">
        <i />
        <i />
        <i />
      </div>
      <div className="mx-auto flex max-w-[1680px] flex-col gap-5 md:flex-row">
        {/* Computador: painel de vidro flutuante. Celular: logo e menu recolhível. */}
        <aside className="vidro flex flex-col rounded-[1.75rem] md:sticky md:top-5 md:h-[calc(100dvh-2.5rem)] md:w-[17rem] md:shrink-0 md:rounded-[2rem] md:p-5">
          <Link
            href={INICIO}
            aria-label="Dashboard"
            className="mb-8 hidden md:block"
          >
            <Marca />
          </Link>
          <GavetaDoMenu marca={<Marca />}>
            <Suspense fallback={<NavSkeleton />}>
              <MenuDoUsuario />
            </Suspense>
          </GavetaDoMenu>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <Suspense fallback={<div className="h-11" />}>
            <BarraSuperior />
          </Suspense>

          <main className="min-w-0 pb-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
