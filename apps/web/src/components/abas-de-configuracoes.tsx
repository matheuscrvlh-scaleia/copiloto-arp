import { Link, usePathname } from "@/lib/navegacao";

export interface Aba {
  href: string;
  rotulo: string;
  descricao: string;
  /** true: só fica ativa na própria rota (não nas de baixo). */
  exata?: boolean;
}

/** Abas de Configurações: a ativa fica escura, as outras em vidro. */
export function Abas({ abas }: { abas: Aba[] }) {
  const atual = usePathname();
  return (
    <nav
      aria-label="Seções de Configurações"
      className="vidro flex w-full gap-1 overflow-x-auto rounded-full p-1 sm:w-fit"
    >
      {abas.map((a) => {
        const ativa =
          atual === a.href || (!a.exata && atual.startsWith(`${a.href}/`));
        return (
          <Link
            key={a.href}
            href={a.href}
            data-guia="aba"
            data-guia-titulo={a.rotulo}
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
