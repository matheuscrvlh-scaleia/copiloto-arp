import { ChevronRight } from "lucide-react";

/**
 * Lista que abre e fecha num botão ("Mostrar 12 pessoas" / "Recolher").
 * <details> nativo: funciona sem JavaScript e guarda o estado depois de
 * salvar. Lista curta já começa aberta.
 */
export function Recolhivel({
  rotulo,
  quantidade,
  abertaAte = 5,
  children,
}: {
  /** O que a lista tem, ex.: "12 pessoas". */
  rotulo: string;
  quantidade: number;
  /** Até quantos itens começa aberta. */
  abertaAte?: number;
  children: React.ReactNode;
}) {
  return (
    <details className="group/recolher" open={quantidade <= abertaAte}>
      <summary className="inline-flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition select-none hover:border-neutral-400 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="size-3.5 transition-transform group-open/recolher:rotate-90"
          aria-hidden
        />
        <span className="group-open/recolher:hidden">Mostrar {rotulo}</span>
        <span className="hidden group-open/recolher:inline">
          Recolher {rotulo}
        </span>
      </summary>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </details>
  );
}
