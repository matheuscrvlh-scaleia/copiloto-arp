import { CircleCheck, CircleDashed, CircleX, Loader } from "lucide-react";
import Link from "next/link";
import { iniciais } from "@/lib/formato";

/** Abas em pílula (a ativa fica branca sobre o vidro). */
export function Abas({
  abas,
  atual,
}: {
  abas: { href: string; rotulo: string }[];
  atual: string;
}) {
  return (
    <nav
      aria-label="Seções"
      className="vidro mb-6 inline-flex max-w-full gap-1 overflow-x-auto rounded-full p-1"
    >
      {abas.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          aria-current={a.href === atual ? "page" : undefined}
          className="shrink-0 rounded-full px-5 py-2 text-sm text-neutral-500 transition hover:text-neutral-900 aria-[current=page]:bg-neutral-900 aria-[current=page]:font-medium aria-[current=page]:text-white"
        >
          {a.rotulo}
        </Link>
      ))}
    </nav>
  );
}

export function Avatar({
  nome,
  apagado = false,
}: {
  nome: string;
  apagado?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={`grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold ${apagado ? "bg-neutral-200 text-neutral-500" : "bg-violet-100 text-violet-700"}`}
    >
      {iniciais(nome)}
    </span>
  );
}

const SITUACOES = {
  ok: { Icone: CircleCheck, classe: "text-green-700 bg-green-50" },
  erro: { Icone: CircleX, classe: "text-red-700 bg-red-50" },
  neutro: { Icone: CircleDashed, classe: "text-neutral-600 bg-neutral-100" },
  rodando: { Icone: Loader, classe: "text-amber-900 bg-amber-50" },
} as const;

/** Situação com ícone e texto (a cor nunca vem sozinha). */
export function Situacao({
  tipo,
  children,
}: {
  tipo: keyof typeof SITUACOES;
  children: React.ReactNode;
}) {
  const { Icone, classe } = SITUACOES[tipo];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${classe}`}
    >
      <Icone className="size-3.5" aria-hidden />
      {children}
    </span>
  );
}

/**
 * Bloco de formulário: título e explicação à esquerda, campos à direita.
 * Vários seguidos ficam separados por uma linha.
 */
export function Secao({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="grid grid-cols-1 gap-4 border-neutral-200/70 py-6 not-first-of-type:border-t first-of-type:pt-0 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-8">
      <div>
        <h2 className="text-sm font-semibold text-neutral-900">{titulo}</h2>
        {descricao && (
          <p className="mt-1 text-xs text-neutral-500">{descricao}</p>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}

/** Botão-link preto em pílula (ação principal da tela). */
export function BotaoLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full bg-neutral-900 py-2 pr-5 pl-2 text-sm font-medium text-white shadow-lg transition hover:bg-neutral-800"
    >
      {children}
    </Link>
  );
}
