"use client";

import { ArrowRight, Building2, CalendarDays, Loader } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Selecao } from "@/components/selecao";
import { ATALHOS, type Atalho, dataValida, diasNoPeriodo } from "@/lib/periodo";

const PERSONALIZADO = "personalizado";
const DO_PERIODO = ["periodo", "de", "ate", "mes"];

/**
 * Barra de filtros das telas: período (atalho ou data inicial e final) e,
 * se houver, departamento. Tudo fica na URL, para o link levar os filtros.
 */
export function FiltroPeriodo({
  de,
  ate,
  atalho,
  hoje,
  departamentos,
  departamento,
}: {
  de: string;
  ate: string;
  atalho: Atalho | null;
  /** aaaa-mm-dd: limite das datas (nada no futuro). */
  hoje: string;
  departamentos?: { id: string; nome: string }[];
  departamento?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [carregando, iniciar] = useTransition();

  function ir(muda: (p: URLSearchParams) => void) {
    const novos = new URLSearchParams(params);
    muda(novos);
    iniciar(() =>
      router.replace(`${pathname}?${novos.toString()}`, { scroll: false }),
    );
  }

  function escolherAtalho(valor: string) {
    if (valor === PERSONALIZADO) return;
    ir((p) => {
      for (const k of DO_PERIODO) p.delete(k);
      p.set("periodo", valor);
    });
  }

  function escolherData(qual: "de" | "ate", valor: string) {
    if (!dataValida(valor)) return;
    ir((p) => {
      for (const k of DO_PERIODO) p.delete(k);
      let novoDe = qual === "de" ? valor : de;
      let novoAte = qual === "ate" ? valor : ate;
      if (novoDe > novoAte) [novoDe, novoAte] = [novoAte, novoDe];
      p.set("de", novoDe);
      p.set("ate", novoAte);
    });
  }

  function escolherDepartamento(valor: string) {
    ir((p) => {
      if (valor) p.set("dep", valor);
      else p.delete("dep");
    });
  }

  const dias = diasNoPeriodo({ de, ate });
  const campoData =
    "rounded-full bg-transparent px-2 py-1.5 text-sm font-medium tabular-nums text-neutral-900 outline-none transition hover:bg-white/70 focus-visible:bg-white/90 focus-visible:ring-2 focus-visible:ring-neutral-900/15 [color-scheme:light] dark:[color-scheme:dark] dark:hover:bg-white/10";
  const divisor = (
    <span
      className="hidden h-6 w-px bg-neutral-900/10 sm:block dark:bg-white/15"
      aria-hidden
    />
  );

  return (
    <fieldset
      data-guia="filtros"
      className="vidro m-0 flex min-w-0 flex-wrap items-center gap-1 rounded-[1.75rem] p-1.5 sm:rounded-full"
      aria-busy={carregando}
    >
      <legend className="sr-only">Filtros da tela</legend>
      <Selecao
        variante="embutida"
        rotulo="Período"
        icone={<CalendarDays className="size-4" />}
        className="w-40"
        valor={atalho ?? PERSONALIZADO}
        aoMudar={escolherAtalho}
        opcoes={[
          ...ATALHOS.map((a) => ({ valor: a.valor, rotulo: a.rotulo })),
          {
            valor: PERSONALIZADO,
            rotulo: "Personalizado",
            descricao: "Escolha a data inicial e a final",
          },
        ]}
      />

      {divisor}

      <div className="flex items-center gap-0.5 px-1">
        <label className="flex items-center gap-1">
          <span className="pl-1 text-xs text-neutral-500">De</span>
          <input
            type="date"
            className={campoData}
            value={de}
            max={hoje}
            onChange={(e) => escolherData("de", e.target.value)}
            aria-label="Data inicial"
          />
        </label>
        <ArrowRight
          className="size-3.5 shrink-0 text-neutral-400"
          aria-hidden
        />
        <label className="flex items-center gap-1">
          <span className="sr-only">Até</span>
          <input
            type="date"
            className={campoData}
            value={ate}
            min={de}
            max={hoje}
            onChange={(e) => escolherData("ate", e.target.value)}
            aria-label="Data final"
          />
        </label>
      </div>

      {departamentos && (
        <>
          {divisor}
          <Selecao
            variante="embutida"
            rotulo="Departamento"
            icone={<Building2 className="size-4" />}
            className="w-60 max-w-full"
            valor={departamento ?? ""}
            aoMudar={escolherDepartamento}
            opcoes={[
              { valor: "", rotulo: "Todos os departamentos" },
              ...departamentos.map((d) => ({ valor: d.id, rotulo: d.nome })),
            ]}
          />
        </>
      )}

      <span className="ml-auto flex items-center gap-1.5 px-3 text-xs text-neutral-500">
        {carregando ? (
          <>
            <Loader
              className="size-3.5 animate-spin motion-reduce:animate-none"
              aria-hidden
            />
            Atualizando…
          </>
        ) : (
          `${dias} ${dias === 1 ? "dia" : "dias"}`
        )}
      </span>
    </fieldset>
  );
}
