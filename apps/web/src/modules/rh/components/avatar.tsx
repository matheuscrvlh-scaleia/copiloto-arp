import { iniciais } from "@arp/shared/formato";

/** Iniciais da pessoa num círculo (o Avatar de components/admin/ui do antigo). */
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
