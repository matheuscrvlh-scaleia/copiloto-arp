"use client";

import { useSearchParams } from "next/navigation";
import { Abas } from "@/components/os/abas";

const RAIZ = "/rh/jornada";

/** Jornada e o fechamento do ciclo do banco de horas; o filtro da Jornada vai junto. */
export function AbasDaJornada() {
  const filtro = useSearchParams().toString();
  return (
    <Abas
      rotulo="Telas da jornada"
      abas={[
        { href: filtro ? `${RAIZ}?${filtro}` : RAIZ, rotulo: "Jornada" },
        {
          href: `${RAIZ}/banco-de-horas`,
          rotulo: "Fechamento do banco de horas",
        },
      ]}
    />
  );
}
