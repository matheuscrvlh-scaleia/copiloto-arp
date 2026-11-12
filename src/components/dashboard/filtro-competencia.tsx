"use client";

import { Building2, CalendarDays, GitCompare, Loader } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Selecao } from "@/components/selecao";
import { formatarMes } from "@/lib/formato";

/**
 * Competência (mês/ano da folha) e departamento, guardados na URL
 * (?mes=2026-07&dep=…). Com `comparar`, uma segunda competência
 * (?comparar=2026-06). Sem período livre: o custo é sempre de uma folha.
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
  /** Competência comparada (aaaa-mm-01); ausente na tela de uma competência só. */
  comparar?: string | null;
  departamentos: { id: string; nome: string }[];
  departamento: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [carregando, iniciar] = useTransition();

  function trocar(nome: string, valor: string) {
    const novos = new URLSearchParams(params);
    // Links antigos do filtro de período não valem mais aqui.
    for (const velho of ["periodo", "de", "ate"]) novos.delete(velho);
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
        aoMudar={(v) => trocar("mes", v)}
        opcoes={opcoes}
      />
      {comparar !== undefined && (
        <>
          <span className="text-xs text-neutral-500">comparar com</span>
          <Selecao
            variante="pilula"
            rotulo="Comparar com"
            icone={<GitCompare className="size-4" />}
            className="w-40"
            valor={comparar?.slice(0, 7) ?? ""}
            aoMudar={(v) => trocar("comparar", v)}
            opcoes={opcoes.filter((o) => o.valor !== mes.slice(0, 7))}
          />
        </>
      )}
      <Selecao
        variante="pilula"
        rotulo="Departamento"
        icone={<Building2 className="size-4" />}
        className="w-64 max-w-full"
        valor={departamento ?? ""}
        aoMudar={(v) => trocar("dep", v)}
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
