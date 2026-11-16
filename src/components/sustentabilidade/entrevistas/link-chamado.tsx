"use client";

import Link from "next/link";
import type { ChamadoDoContrato } from "@/lib/sustentabilidade/entrevistas-controle";

// Link do chamado da entrevista dentro de uma linha clicável: abre o
// chamado sem abrir também a ficha da linha.

export function LinkDoChamado({ c }: { c: ChamadoDoContrato | null }) {
  if (!c) return <span className="text-neutral-400">—</span>;
  return (
    <Link
      href={c.href}
      onClick={(e) => e.stopPropagation()}
      className="whitespace-nowrap text-sm font-medium underline-offset-4 hover:underline"
      title={
        c.responsavel ? `Responsável: ${c.responsavel}` : "Sem responsável"
      }
    >
      {c.numero}
      <span className="ml-1 text-xs font-normal text-neutral-500">
        {c.situacao}
        {c.responsavel ? ` · ${c.responsavel}` : ""}
      </span>
    </Link>
  );
}
