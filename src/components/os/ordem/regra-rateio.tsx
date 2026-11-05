"use client";

import { useState } from "react";
import { classeCampo } from "@/components/estilos";
import { Selecao } from "@/components/selecao";
import { formatarNumero } from "@/lib/formato";
import { REGRAS_RATEIO, type RegraRateio } from "@/lib/os/rotulos";
import { rotulo } from "./estilos";

// Regra do rateio e o valor: o campo só aparece onde vale (Manual, em R$;
// Porcentagem, em %). Nas outras regras o servidor ignora o valor.

const UNIDADE: Partial<Record<RegraRateio, string>> = {
  manual: "R$",
  percentual: "%",
};

export function CamposDoRateio({
  regra,
  valor,
}: {
  regra: RegraRateio | null;
  valor: number | null;
}) {
  const [atual, setAtual] = useState<RegraRateio>(regra ?? "hora_trabalhada");
  const unidade = UNIDADE[atual];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
      <label className={rotulo}>
        Regra
        <Selecao
          name="rateio_regra"
          rotulo="Regra do rateio"
          valorInicial={atual}
          aoMudar={(v) => setAtual(v as RegraRateio)}
          opcoes={Object.entries(REGRAS_RATEIO).map(([v, r]) => ({
            valor: v,
            rotulo: r,
          }))}
        />
      </label>
      {unidade && (
        <label className={rotulo}>
          {atual === "manual" ? "Valor (R$)" : "Percentual (%)"}
          <span className="relative">
            <input
              name="rateio_valor"
              inputMode="decimal"
              defaultValue={valor === null ? "" : formatarNumero(valor, 2)}
              placeholder={atual === "manual" ? "0,00" : "0 a 100"}
              className={`${classeCampo} ${atual === "manual" ? "pl-10" : "pr-9"}`}
            />
            <span
              aria-hidden
              className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-sm text-neutral-500 ${atual === "manual" ? "left-3" : "right-3"}`}
            >
              {unidade}
            </span>
          </span>
        </label>
      )}
    </div>
  );
}
