import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import {
  descreverIntervalo,
  POR_PAGINA,
  paginasVisiveis,
  totalDePaginas,
} from "@/lib/os/paginacao";

// Paginação das listas grandes do módulo Tickets (servidor busca só a
// página). Links comuns: a URL guarda a página junto dos filtros, então o
// voltar do navegador e o compartilhar do link levam a página certa.

/** URL da página `p`, mantendo os outros parâmetros (a 1 sai da URL). */
export function hrefDaPagina(
  caminho: string,
  params: URLSearchParams | Record<string, string | string[] | undefined>,
  p: number,
  nome = "pagina",
): string {
  const q = new URLSearchParams();
  if (params instanceof URLSearchParams) {
    for (const [k, v] of params) q.append(k, v);
  } else {
    for (const [k, v] of Object.entries(params)) {
      if (Array.isArray(v)) for (const x of v) q.append(k, x);
      else if (v !== undefined) q.set(k, v);
    }
  }
  q.delete(nome);
  if (p > 1) q.set(nome, String(p));
  const s = q.toString();
  return s ? `${caminho}?${s}` : caminho;
}

export function Paginacao({
  pagina,
  total,
  porPagina = POR_PAGINA,
  href,
}: {
  pagina: number;
  total: number;
  porPagina?: number;
  /** URL de cada página (use `hrefDaPagina`). */
  href: (p: number) => string;
}) {
  const paginas = totalDePaginas(total, porPagina);
  const atual = Math.min(pagina, paginas);
  const botao =
    "grid size-8 place-items-center rounded-full text-sm tabular-nums transition";
  return (
    <nav
      aria-label="Paginação"
      className="flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500"
    >
      <span className="tabular-nums">
        {descreverIntervalo(atual, total, porPagina)}
      </span>
      {paginas > 1 && (
        <div className="flex items-center gap-1">
          <BotaoSeta
            href={atual > 1 ? href(atual - 1) : null}
            rotulo="Página anterior"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </BotaoSeta>
          {paginasVisiveis(atual, paginas).map((p, i) =>
            p === null ? (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: as reticências não têm identidade própria
                key={`buraco-${i}`}
                aria-hidden
                className="px-1 text-neutral-400"
              >
                …
              </span>
            ) : (
              <Link
                key={p}
                href={href(p)}
                scroll={false}
                aria-current={p === atual ? "page" : undefined}
                aria-label={`Página ${p}`}
                className={`${botao} ${p === atual ? "bg-neutral-900 font-medium text-white" : "text-neutral-700 hover:bg-white/70"}`}
              >
                {p}
              </Link>
            ),
          )}
          <BotaoSeta
            href={atual < paginas ? href(atual + 1) : null}
            rotulo="Próxima página"
          >
            <ChevronRight className="size-4" aria-hidden />
          </BotaoSeta>
        </div>
      )}
    </nav>
  );
}

function BotaoSeta({
  href,
  rotulo,
  children,
}: {
  href: string | null;
  rotulo: string;
  children: React.ReactNode;
}) {
  const classe =
    "vidro grid size-8 place-items-center rounded-full text-neutral-700 transition";
  if (!href)
    return (
      <span aria-hidden className={`${classe} opacity-40`}>
        {children}
      </span>
    );
  return (
    <Link
      href={href}
      scroll={false}
      aria-label={rotulo}
      className={`${classe} hover:border-neutral-400`}
    >
      {children}
    </Link>
  );
}
