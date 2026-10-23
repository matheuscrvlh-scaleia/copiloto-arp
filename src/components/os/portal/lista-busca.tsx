"use client";

import { Loader, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

// Lista em cartões empilhados com busca (melhor que tabela no celular). A
// busca vai para a URL (?q=) e o servidor devolve só a página pedida; a
// paginação vem de fora (componente Paginacao).

export interface ItemBusca {
  chave: string;
  conteudo: React.ReactNode;
}

const ESPERA_MS = 350;

export function ListaBusca({
  itens,
  busca,
  placeholder = "Buscar…",
  vazio = "Nada por aqui.",
  paginacao,
}: {
  /** Os itens desta página. */
  itens: ItemBusca[];
  /** O texto buscado agora (da URL). */
  busca: string;
  placeholder?: string;
  vazio?: string;
  paginacao?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [carregando, iniciar] = useTransition();
  const [texto, setTexto] = useState(busca);
  // A busca mudou por fora (cartão, voltar do navegador): o campo acompanha.
  const [anterior, setAnterior] = useState(busca);
  if (busca !== anterior) {
    setAnterior(busca);
    setTexto(busca);
  }

  // Busca enquanto digita, sem uma ida ao servidor por tecla; volta à
  // página 1.
  useEffect(() => {
    if (texto.trim() === busca) return;
    const t = setTimeout(() => {
      const p = new URLSearchParams(params);
      p.delete("pagina");
      if (texto.trim()) p.set("q", texto.trim());
      else p.delete("q");
      const qs = p.toString();
      iniciar(() =>
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }),
      );
    }, ESPERA_MS);
    return () => clearTimeout(t);
  }, [texto, busca, params, pathname, router]);

  return (
    <div className="flex flex-col gap-3" aria-busy={carregando}>
      <label className="relative block">
        <span className="sr-only">{placeholder}</span>
        {carregando ? (
          <Loader
            className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 animate-spin text-neutral-400 motion-reduce:animate-none"
            aria-hidden
          />
        ) : (
          <Search
            className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-neutral-400"
            aria-hidden
          />
        )}
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-full border border-neutral-200 bg-white/80 py-2.5 pr-4 pl-10 text-sm outline-none transition focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5"
        />
      </label>
      {itens.length === 0 ? (
        <p className="py-6 text-sm text-neutral-500">
          {busca ? "Nada encontrado." : vazio}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-900/[0.06]">
          {itens.map((i) => (
            <li key={i.chave} className="py-3 first:pt-1 last:pb-1">
              {i.conteudo}
            </li>
          ))}
        </ul>
      )}
      {paginacao}
    </div>
  );
}
