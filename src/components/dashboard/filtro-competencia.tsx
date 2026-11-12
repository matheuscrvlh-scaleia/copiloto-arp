"use client";

import { Building2, CalendarDays, GitCompare, Loader, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Selecao } from "@/components/selecao";
import { formatarMes } from "@/lib/formato";

/**
 * Competência (mês/ano da folha), departamento e, com "Comparar", uma
 * segunda competência, guardados na URL (?mes=2026-07&comparar=2026-06&dep=…).
 * Sem período livre: o custo é sempre de uma folha.
 */
export function FiltroCompetencia({
  meses,
  mes,
  comparar,
  departamentos,
  departamento,
}: {
  /** Competências com folha, "aaaa-mm-01", da mais recente para a mais antiga. */
  meses: string[];
  mes: string;
  /** Competência comparada (aaaa-mm-01), ou null sem comparação. */
  comparar: string | null;
  departamentos: { id: string; nome: string }[];
  departamento: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [carregando, iniciar] = useTransition();

  function trocar(mudancas: Record<string, string | null>) {
    const novos = new URLSearchParams(params);
    // Links antigos do filtro de período não valem mais aqui.
    for (const velho of ["periodo", "de", "ate"]) novos.delete(velho);
    for (const [nome, valor] of Object.entries(mudancas))
      if (valor) novos.set(nome, valor);
      else novos.delete(nome);
    iniciar(() =>
      router.replace(`${pathname}?${novos.toString()}`, { scroll: false }),
    );
  }

  const opcoes = meses.map((m) => ({
    valor: m.slice(0, 7),
    rotulo: formatarMes(m),
  }));
  // Para comparar: a competência anterior com folha, ou a mais antiga.
  const sugerida =
    meses.find((m) => m < mes) ?? meses.find((m) => m !== mes) ?? null;

  return (
    <div
      data-guia="filtros"
      className="flex flex-wrap items-center gap-2"
      aria-busy={carregando}
    >
      <Selecao
        variante="pilula"
        rotulo="Competência"
        icone={<CalendarDays className="size-4" />}
        className="w-40"
        valor={mes.slice(0, 7)}
        aoMudar={(v) => trocar({ mes: v })}
        opcoes={opcoes}
      />
      {comparar ? (
        <>
          <span className="text-xs text-neutral-500">comparar com</span>
          <Selecao
            variante="pilula"
            rotulo="Comparar com"
            icone={<GitCompare className="size-4" />}
            className="w-40"
            valor={comparar.slice(0, 7)}
            aoMudar={(v) => trocar({ comparar: v })}
            opcoes={opcoes.filter((o) => o.valor !== mes.slice(0, 7))}
          />
          <button
            type="button"
            onClick={() => trocar({ comparar: null })}
            className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs font-medium text-neutral-600 hover:bg-white/60 hover:text-neutral-900"
          >
            <X className="size-3.5" aria-hidden />
            Sem comparação
          </button>
        </>
      ) : (
        sugerida && (
          <button
            type="button"
            onClick={() => trocar({ comparar: sugerida.slice(0, 7) })}
            className="vidro inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900"
          >
            <GitCompare className="size-4" aria-hidden />
            Comparar
          </button>
        )
      )}
      <Selecao
        variante="pilula"
        rotulo="Departamento"
        icone={<Building2 className="size-4" />}
        className="w-64 max-w-full"
        valor={departamento ?? ""}
        aoMudar={(v) => trocar({ dep: v })}
        opcoes={[
          { valor: "", rotulo: "Todos os departamentos" },
          ...departamentos.map((d) => ({ valor: d.id, rotulo: d.nome })),
        ]}
      />
      {carregando && (
        <span className="flex items-center gap-1.5 text-xs text-neutral-500">
          <Loader
            className="size-3.5 animate-spin motion-reduce:animate-none"
            aria-hidden
          />
          Atualizando…
        </span>
      )}
    </div>
  );
}
