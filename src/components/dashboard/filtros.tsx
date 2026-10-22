"use client";

import { Building2, CalendarDays, Loader } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Selecao } from "@/components/selecao";
import { formatarMes } from "@/lib/formato";

/**
 * Mês e departamento numa linha só, guardados na URL (?mes=2026-10&dep=…),
 * para o link da tela levar os filtros junto. Sem `departamentos`, só o mês.
 */
export function Filtros({
  meses,
  mes,
  departamentos,
  departamento,
}: {
  /** Competências "aaaa-mm-01", da mais recente para a mais antiga. */
  meses: string[];
  mes: string;
  departamentos?: { id: string; nome: string }[];
  departamento?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [carregando, iniciar] = useTransition();

  function trocar(nome: "mes" | "dep", valor: string) {
    const novos = new URLSearchParams(params);
    if (valor) novos.set(nome, valor);
    else novos.delete(nome);
    iniciar(() =>
      router.replace(`${pathname}?${novos.toString()}`, { scroll: false }),
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy={carregando}>
      <Selecao
        variante="pilula"
        rotulo="Mês"
        icone={<CalendarDays className="size-4" />}
        className="w-40"
        valor={mes.slice(0, 7)}
        aoMudar={(v) => trocar("mes", v)}
        opcoes={meses.map((m) => ({
          valor: m.slice(0, 7),
          rotulo: formatarMes(m),
        }))}
      />
      {departamentos && (
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
      )}
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
