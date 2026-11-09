"use client";

import { CalendarDays, Loader, PlugZap, RotateCcw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Selecao } from "@/components/selecao";
import { formatarMes } from "@/lib/formato";

/**
 * Mês e unidade das telas de energia (Contas e Energia solar), na URL
 * (?mes=2026-09&unidade=0002722684): o link leva os filtros junto.
 */
export function FiltrosEnergia({
  meses,
  mes,
  unidades,
  unidade,
  guia,
}: {
  /** Meses com fatura (aaaa-mm-01), do mais recente para o mais antigo. */
  meses: string[];
  mes: string;
  unidades: { valor: string; rotulo: string }[];
  unidade: string;
  /** Âncora do guia passo a passo (ex.: "op-contas-filtros"). */
  guia: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [carregando, iniciar] = useTransition();

  function trocar(nome: "mes" | "unidade", valor: string) {
    const novos = new URLSearchParams(params);
    if (valor) novos.set(nome, valor);
    else novos.delete(nome);
    const q = novos.toString();
    iniciar(() =>
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false }),
    );
  }

  const filtrando = params.has("mes") || params.has("unidade");
  return (
    <div
      data-guia={guia}
      className="flex flex-wrap items-center gap-2"
      aria-busy={carregando}
    >
      <Selecao
        variante="pilula"
        rotulo="Mês"
        icone={<CalendarDays className="size-4" />}
        className="w-40"
        valor={mes.slice(0, 7)}
        aoMudar={(v) => trocar("mes", v === meses[0]?.slice(0, 7) ? "" : v)}
        opcoes={meses.map((m) => ({
          valor: m.slice(0, 7),
          rotulo: formatarMes(m),
        }))}
      />
      <Selecao
        variante="pilula"
        rotulo="Unidade"
        icone={<PlugZap className="size-4" />}
        className="w-72 max-w-full"
        valor={unidade}
        aoMudar={(v) => trocar("unidade", v)}
        opcoes={[{ valor: "", rotulo: "Todas as unidades" }, ...unidades]}
      />
      {filtrando && (
        <button
          type="button"
          onClick={() =>
            iniciar(() => router.replace(pathname, { scroll: false }))
          }
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-white/60 hover:text-neutral-900"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Limpar
        </button>
      )}
      {carregando && (
        <output className="flex items-center gap-1.5 text-xs text-neutral-500">
          <Loader
            className="size-3.5 animate-spin motion-reduce:animate-none"
            aria-hidden
          />
          Atualizando…
        </output>
      )}
    </div>
  );
}
