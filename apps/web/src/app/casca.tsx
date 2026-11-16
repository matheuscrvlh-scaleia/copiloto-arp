import { Outlet } from "react-router";
import { Marca } from "@/components/marca";
import { INICIO } from "@/config/navigation";
import { Link } from "@/lib/navegacao";
import { BarraSuperior } from "./shell/barra-superior";
import { FimPorInatividade } from "./shell/fim-por-inatividade";
import { GavetaDoMenu } from "./shell/gaveta-do-menu";
import { MenuDoUsuario } from "./shell/menu-do-usuario";
import { NavSkeleton } from "./shell/nav-list";

// Casca das telas autenticadas: fundo, moldura, marca, menu e barra do topo.
// O menu é renderizado uma vez só: no computador é a coluna lateral, no
// celular abre pela gaveta. As telas entram no <main> (rotas filhas).

function Moldura({
  menu,
  barra,
  children,
}: {
  menu: React.ReactNode;
  barra: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh p-3 md:p-5">
      {/* Brilhos coloridos atrás do vidro (index.css). */}
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
          <GavetaDoMenu marca={<Marca />}>{menu}</GavetaDoMenu>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {barra}
          <main className="min-w-0 pb-6">{children}</main>
        </div>
      </div>
    </div>
  );
}

/** A casca com a sessão: menu e barra de quem está logado. */
export function Casca() {
  return (
    <>
      <FimPorInatividade />
      <Moldura menu={<MenuDoUsuario />} barra={<BarraSuperior />}>
        <Outlet />
      </Moldura>
    </>
  );
}

/** A mesma moldura enquanto a API responde quem está logado. */
export function CascaCarregando() {
  return <Moldura menu={<NavSkeleton />} barra={<div className="h-11" />} />;
}
