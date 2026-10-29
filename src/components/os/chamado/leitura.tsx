"use client";

import { Building2, CheckCheck, UserRound } from "lucide-react";
import { useActionState } from "react";
import { formatarDataHora } from "@/lib/formato";
import { marcarLido } from "@/server/os/acoes/chamados";

// Aviso é para ser lido: cada pessoa que recebe aperta "Marcar como lido".
// Quem vê o aviso vê quem já leu e quem ainda falta.

export interface Leitor {
  id: string;
  nome: string;
  lidoEm: string | null;
}

export function BotaoLido({ id }: { id: string }) {
  const [estado, executar, enviando] = useActionState(marcarLido, {});
  return (
    <form action={executar} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={enviando}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-neutral-900 px-5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60"
      >
        <CheckCheck className="size-4" aria-hidden />
        Marcar como lido
      </button>
      {estado.erro && (
        <p role="alert" className="text-xs text-red-700">
          {estado.erro}
        </p>
      )}
    </form>
  );
}

export function Leitura({
  para,
  leitores,
}: {
  /** Destinos do aviso (setor ou pessoa) e o recado de cada um. */
  para: { id: string; nome: string; pessoa: boolean; titulo: string | null }[];
  leitores: Leitor[];
}) {
  const leram = leitores.filter(
    (l): l is Leitor & { lidoEm: string } => !!l.lidoEm,
  );
  const faltam = leitores.filter((l) => !l.lidoEm);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div
          role="progressbar"
          aria-label="Pessoas que leram"
          aria-valuemin={0}
          aria-valuemax={leitores.length}
          aria-valuenow={leram.length}
          className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-900/[0.07]"
        >
          <div
            className="h-full rounded-full bg-marca"
            style={{
              width: `${(leram.length / Math.max(1, leitores.length)) * 100}%`,
            }}
          />
        </div>
        <span className="text-xs font-medium text-neutral-700">
          {leram.length} de {leitores.length} leram
        </span>
      </div>

      {para.length > 0 && (
        <ul className="flex flex-col gap-2">
          {para.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-2xl border border-neutral-900/[0.06] bg-white/60 p-3"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-neutral-900/[0.05] text-neutral-600">
                {p.pessoa ? (
                  <UserRound className="size-4" aria-hidden />
                ) : (
                  <Building2 className="size-4" aria-hidden />
                )}
              </span>
              <span className="min-w-0 text-sm">
                <span className="font-medium">{p.nome}</span>
                {p.titulo && (
                  <span className="text-neutral-600"> · {p.titulo}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {faltam.length > 0 && (
        <p className="text-sm text-neutral-700">
          <span className="font-medium">Ainda não leram:</span>{" "}
          {faltam.map((l) => l.nome).join(", ")}
        </p>
      )}
      {leram.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm text-neutral-700">
          {leram.map((l) => (
            <li key={l.id} className="flex items-center gap-2">
              <CheckCheck
                className="size-4 shrink-0 text-green-700"
                aria-hidden
              />
              <span className="font-medium">{l.nome}</span>
              <span className="text-xs text-neutral-500">
                leu em {formatarDataHora(l.lidoEm)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!leitores.length && (
        <p className="text-sm text-neutral-500">
          Ninguém ativo recebe este aviso.
        </p>
      )}
    </div>
  );
}
