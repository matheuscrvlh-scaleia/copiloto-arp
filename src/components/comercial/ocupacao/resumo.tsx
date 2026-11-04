import { ArrowLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";

// Peças das páginas de detalhe (LUC, contrato, contato): voltar, os dados
// em pares rótulo e valor (mesmo visual do resumo do modal de detalhe) e os
// atalhos para outras telas.

export function Voltar({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900"
    >
      <ArrowLeft className="size-4" aria-hidden /> {children}
    </Link>
  );
}

export function Resumo({
  itens,
}: {
  itens: { rotulo: string; valor: React.ReactNode }[];
}) {
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
      {itens.map((r) => (
        <div
          key={r.rotulo}
          className="min-w-0 rounded-2xl bg-neutral-900/[0.04] px-4 py-3"
        >
          <dt className="text-[11px] text-neutral-500">{r.rotulo}</dt>
          <dd className="mt-0.5 break-words text-base font-semibold tabular-nums">
            {r.valor}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Atalho({
  href,
  children,
  principal = false,
}: {
  href: string;
  children: React.ReactNode;
  principal?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        principal
          ? "inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
          : "inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400"
      }
    >
      {children}
      <ArrowUpRight className="size-4" aria-hidden />
    </Link>
  );
}
