import { Menu as IconeMenu } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Marca } from "@/components/marca";
import { BarraSuperior } from "@/components/shell/barra-superior";
import { MenuDoUsuario } from "@/components/shell/menu-do-usuario";
import { NavSkeleton } from "@/components/shell/nav-list";
import { INICIO } from "@/config/navigation";

function Menu() {
  return (
    <Suspense fallback={<NavSkeleton />}>
      <MenuDoUsuario />
    </Suspense>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh p-3 md:p-5">
      {/* Brilhos coloridos atrás do vidro (globals.css). */}
      <div aria-hidden className="aurora">
        <i />
        <i />
        <i />
      </div>
      <div className="mx-auto flex max-w-[1680px] gap-5">
        {/* Menu lateral (computador): painel de vidro flutuante. */}
        <aside className="vidro sticky top-5 hidden h-[calc(100dvh-2.5rem)] w-[17rem] shrink-0 flex-col rounded-[2rem] p-5 md:flex">
          <Link href={INICIO} aria-label="Dashboard" className="mb-8 block">
            <Marca />
          </Link>
          <div className="flex min-h-0 flex-1 flex-col">
            <Menu />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {/* Celular: logo e menu recolhível. */}
          <details className="vidro rounded-[1.75rem] md:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3">
              <Marca />
              <span className="grid size-10 place-items-center rounded-full bg-neutral-900 text-white">
                <IconeMenu className="size-4" aria-hidden />
                <span className="sr-only">Menu</span>
              </span>
            </summary>
            <div className="flex max-h-[75dvh] flex-col px-4 pb-4">
              <Menu />
            </div>
          </details>

          <Suspense fallback={<div className="h-11" />}>
            <BarraSuperior />
          </Suspense>

          <main className="min-w-0 pb-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
