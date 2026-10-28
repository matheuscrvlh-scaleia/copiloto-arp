"use client";

import { Building2, Loader, Tag, UserRound } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Selecao } from "@/components/selecao";

/**
 * Setor, categoria e pessoa (responsável) do painel, ao lado do filtro de
 * período padrão do sistema. O setor troca a rota (/paineis/<setor>); os
 * outros vão na URL (?categoria=&pessoa=).
 */
export function FiltrosDoPainel({
  setores,
  setor,
  categorias,
  categoria,
  pessoas,
  pessoa,
}: {
  /** Rota do painel de cada setor (a do geral, para quem o vê). */
  setores: { rota: string; nome: string }[];
  setor: string;
  categorias: { id: string; nome: string; grupo?: string }[];
  categoria: string | null;
  pessoas: { id: string; nome: string }[];
  pessoa: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [carregando, iniciar] = useTransition();

  function trocar(nome: "categoria" | "pessoa", valor: string) {
    const novos = new URLSearchParams(params);
    if (valor) novos.set(nome, valor);
    else novos.delete(nome);
    iniciar(() =>
      router.replace(`${pathname}?${novos.toString()}`, { scroll: false }),
    );
  }

  // A categoria é do setor: sai ao trocar de setor.
  function trocarSetor(rota: string) {
    const novos = new URLSearchParams(params);
    novos.delete("categoria");
    iniciar(() =>
      router.push(`${rota}?${novos.toString()}`, { scroll: false }),
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy={carregando}>
      {setores.length > 1 && (
        <Selecao
          variante="pilula"
          rotulo="Setor"
          icone={<Building2 className="size-4" />}
          className="w-64 max-w-full"
          valor={setor}
          aoMudar={trocarSetor}
          opcoes={setores.map((s) => ({ valor: s.rota, rotulo: s.nome }))}
        />
      )}
      <Selecao
        variante="pilula"
        rotulo="Categoria"
        icone={<Tag className="size-4" />}
        className="w-64 max-w-full"
        valor={categoria ?? ""}
        aoMudar={(v) => trocar("categoria", v)}
        opcoes={[
          { valor: "", rotulo: "Todas as categorias" },
          ...categorias.map((c) => ({
            valor: c.id,
            rotulo: c.nome,
            descricao: c.grupo,
          })),
        ]}
      />
      <Selecao
        variante="pilula"
        rotulo="Pessoa responsável"
        icone={<UserRound className="size-4" />}
        className="w-64 max-w-full"
        valor={pessoa ?? ""}
        aoMudar={(v) => trocar("pessoa", v)}
        opcoes={[
          { valor: "", rotulo: "Todas as pessoas" },
          ...pessoas.map((p) => ({ valor: p.id, rotulo: p.nome })),
        ]}
      />
      {carregando && (
        <span className="flex items-center gap-1.5 text-xs text-neutral-500">
          <Loader
            className="size-3.5 animate-spin motion-reduce:animate-none"
            aria-hidden
          />
          Atualizando…
        </span>
      )}
    </div>
  );
}
