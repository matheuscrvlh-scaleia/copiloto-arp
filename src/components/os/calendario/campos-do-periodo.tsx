"use client";

import { ArrowRight, Loader } from "lucide-react";
import {
  useFiltrosDaTela,
  type Valores,
} from "@/components/os/filtros/barra-filtros";

// De / até da visão "Período" do calendário: vão para a URL e ficam
// lembrados como os outros filtros da tela.

const classe =
  "rounded-full bg-transparent px-3 py-2 text-sm font-medium text-neutral-800 tabular-nums outline-none transition hover:bg-white/80 focus:bg-white/90 dark:hover:bg-white/10 dark:focus:bg-white/15";

export function CamposDoPeriodo({
  de,
  ate,
  valores,
}: {
  de: string;
  ate: string;
  valores: Valores;
}) {
  const { aplicar, carregando } = useFiltrosDaTela("calendario");
  const trocar = (mudancas: Valores) =>
    aplicar({ ...valores, de, ate, ...mudancas });
  return (
    <div
      className="vidro inline-flex items-center gap-0.5 rounded-full p-1"
      aria-busy={carregando}
    >
      <label className="flex items-center">
        <span className="sr-only">De</span>
        <input
          type="date"
          value={de}
          onChange={(e) => e.target.value && trocar({ de: e.target.value })}
          className={classe}
        />
      </label>
      <ArrowRight className="size-3.5 shrink-0 text-neutral-400" aria-hidden />
      <label className="flex items-center">
        <span className="sr-only">Até</span>
        <input
          type="date"
          value={ate}
          min={de}
          onChange={(e) => e.target.value && trocar({ ate: e.target.value })}
          className={classe}
        />
      </label>
      {carregando && (
        <Loader
          className="mx-2 size-3.5 shrink-0 animate-spin text-neutral-500 motion-reduce:animate-none"
          aria-label="Atualizando"
        />
      )}
    </div>
  );
}
