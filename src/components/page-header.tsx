import { Hourglass } from "lucide-react";

export function PageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <header data-guia="titulo" className="mb-6">
      <h1 className="text-4xl font-semibold tracking-tight text-neutral-900 md:text-5xl">
        {title}
      </h1>
      {description && (
        <p className="mt-3 max-w-3xl text-sm text-neutral-500">{description}</p>
      )}
    </header>
  );
}

// Cada variante define fundo, texto e borda uma vez só: duas classes da
// mesma propriedade no mesmo elemento dependem da ordem do CSS, não do código.
const VARIANTES = {
  claro: "vidro text-neutral-900",
  escuro: "destaque",
  tracejado:
    "border border-dashed border-neutral-900/15 bg-white/25 text-neutral-500 backdrop-blur-xl",
} as const;

export function Cartao({
  children,
  className = "",
  variante = "claro",
}: {
  children: React.ReactNode;
  /** Não use para trocar cor de fundo ou texto: use `variante`. */
  className?: string;
  variante?: keyof typeof VARIANTES;
}) {
  return (
    <div
      className={`rounded-[1.75rem] p-6 ${VARIANTES[variante]} ${className}`}
    >
      {children}
    </div>
  );
}

/** Tela que ainda depende de outra fonte de dados ou etapa. */
export function EmConstrucao({ motivo }: { motivo: string }) {
  return (
    <div className="vidro relative isolate overflow-hidden rounded-[2rem] px-6 py-12 text-center md:py-16">
      <div
        aria-hidden
        className="absolute -top-24 left-1/2 -z-10 h-56 w-2/3 -translate-x-1/2 animate-pulse rounded-full bg-marca/25 blur-3xl [animation-duration:4s] motion-reduce:animate-none"
      />
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-neutral-900 text-white shadow-[0_0_0_8px_rgb(0_0_0/0.05)]">
        <Hourglass className="size-6" aria-hidden />
      </span>
      <p className="mt-5 text-lg font-semibold">Ainda sem dados</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">{motivo}</p>
    </div>
  );
}

export { Carregando } from "@/components/carregando";
