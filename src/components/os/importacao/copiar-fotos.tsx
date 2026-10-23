"use client";

import { Images } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

// Fotos da importação: copiadas do pacote para o bucket aos poucos (um
// backup pode ter milhares). Cada chamada copia o que dá no tempo de uma
// requisição; o botão repete até acabar e pode ser retomado depois.

interface Lote {
  copiadas: number;
  total: number;
  falhas: string[];
  erro?: string;
}

export function CopiarFotos({
  importacaoId,
  copiadas: inicial,
  total,
  copiar,
}: {
  importacaoId: string;
  copiadas: number;
  total: number;
  copiar: (importacaoId: string) => Promise<Lote>;
}) {
  const router = useRouter();
  const [copiadas, setCopiadas] = useState(inicial);
  const [rodando, setRodando] = useState(false);
  const [falhas, setFalhas] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const pct = total ? Math.round((copiadas / total) * 100) : 100;

  async function comecar() {
    setRodando(true);
    setErro(null);
    let antes = copiadas;
    try {
      for (;;) {
        const r = await copiar(importacaoId);
        if (r.erro) throw new Error(r.erro);
        setCopiadas(r.copiadas);
        setFalhas(r.falhas);
        // Terminou, ou só sobraram as que não dá para copiar.
        if (r.copiadas >= r.total || r.copiadas === antes) break;
        antes = r.copiadas;
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao copiar as fotos.");
    } finally {
      setRodando(false);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Images className="size-4 text-neutral-500" aria-hidden />
        <span className="text-sm">
          {copiadas} de {total} fotos copiadas
        </span>
        <div
          role="progressbar"
          aria-label="Fotos copiadas"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="h-2 w-40 overflow-hidden rounded-full bg-neutral-900/[0.08]"
        >
          <div
            className="h-full rounded-full bg-marca transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        {copiadas < total && (
          <button
            type="button"
            onClick={comecar}
            disabled={rodando}
            className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-60"
          >
            {rodando
              ? "Copiando…"
              : copiadas
                ? "Continuar a copiar"
                : "Copiar as fotos"}
          </button>
        )}
      </div>
      {erro && (
        <p role="alert" className="text-sm text-red-700">
          {erro}
        </p>
      )}
      {falhas.length > 0 && (
        <details className="text-xs text-amber-900">
          <summary className="cursor-pointer">
            {falhas.length}{" "}
            {falhas.length === 1 ? "foto não pôde" : "fotos não puderam"} ser
            copiadas
          </summary>
          <ul className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto">
            {falhas.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
