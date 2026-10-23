import { AlertTriangle, Inbox } from "lucide-react";
import Link from "next/link";
import { formatarNumero, iniciais } from "@/lib/formato";
import type { Carga } from "@/lib/os/lista";

// Carga por pessoa (Meu setor): quantos abertos e atrasados cada um tem,
// para o gestor distribuir. Clicar na pessoa filtra a lista por ela; a fila
// mostra o que está sem responsável.

export function CargaPorPessoa({
  carga,
  hrefPessoa,
  hrefFila,
}: {
  carga: Carga[];
  hrefPessoa: Record<string, string>;
  hrefFila: string;
}) {
  if (!carga.length) return null;
  const maior = Math.max(...carga.map((c) => c.abertos), 1);
  return (
    <section
      aria-labelledby="carga-titulo"
      className="vidro rounded-[1.75rem] p-4 md:p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="carga-titulo" className="text-base font-semibold">
          Carga por pessoa
        </h2>
        <p className="text-xs text-neutral-500">
          Abertos e atrasados de cada um · clique para ver os chamados
        </p>
      </div>
      <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {carga.map((c) => {
          const href = c.id ? hrefPessoa[c.id] : hrefFila;
          return (
            <li key={c.id ?? "fila"} className="shrink-0">
              <Link
                href={href ?? hrefFila}
                scroll={false}
                className="flex w-44 flex-col gap-2 rounded-2xl border border-neutral-900/[0.06] bg-white/60 p-3 transition hover:border-neutral-900/20 hover:bg-white/90"
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={`grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold ${c.id ? "bg-violet-100 text-violet-700" : "bg-amber-50 text-amber-900"}`}
                  >
                    {c.id ? iniciais(c.nome) : <Inbox className="size-3.5" />}
                  </span>
                  <span className="truncate text-sm font-medium">{c.nome}</span>
                </span>
                <span
                  aria-hidden
                  className="h-1.5 overflow-hidden rounded-full bg-neutral-900/[0.06]"
                >
                  <span
                    className="block h-full rounded-full bg-neutral-900/60"
                    style={{ width: `${(c.abertos / maior) * 100}%` }}
                  />
                </span>
                <span className="flex items-center justify-between text-xs tabular-nums">
                  <span className="text-neutral-600">
                    {formatarNumero(c.abertos)}{" "}
                    {c.abertos === 1 ? "aberto" : "abertos"}
                  </span>
                  {c.atrasados > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700">
                      <AlertTriangle className="size-3" aria-hidden />
                      {formatarNumero(c.atrasados)}{" "}
                      {c.atrasados === 1 ? "atrasado" : "atrasados"}
                    </span>
                  ) : (
                    <span className="text-neutral-400">em dia</span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
