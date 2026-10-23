"use client";

import { Repeat } from "lucide-react";
import { useId, useState } from "react";
import { classeCampo } from "@/components/estilos";
import {
  descreverRecorrencia,
  type Frequencia,
  type Recorrencia,
} from "@/lib/os/recorrencia";

// Repetir: o chamado vira uma série (a rotina cria a próxima ocorrência
// alguns dias antes). Grava a regra em JSON num campo oculto "recorrencia".

const FREQUENCIAS: { valor: Frequencia; rotulo: string }[] = [
  { valor: "diaria", rotulo: "Todo dia" },
  { valor: "semanal", rotulo: "Toda semana" },
  { valor: "mensal", rotulo: "Todo mês" },
  { valor: "cada_n_dias", rotulo: "A cada N dias" },
  { valor: "cada_n_meses", rotulo: "A cada N meses" },
];

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const PILULA_OPCAO =
  "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 aria-pressed:border-neutral-900 aria-pressed:bg-neutral-900 aria-pressed:text-white";

export function Repetir() {
  const [ligado, setLigado] = useState(false);
  const [regra, setRegra] = useState<Recorrencia>({ frequencia: "semanal" });
  const id = useId();
  const comIntervalo =
    regra.frequencia === "cada_n_dias" || regra.frequencia === "cada_n_meses";
  const mudar = (r: Partial<Recorrencia>) => setRegra((x) => ({ ...x, ...r }));

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2.5 text-sm font-medium">
        <input
          type="checkbox"
          checked={ligado}
          onChange={(e) => setLigado(e.target.checked)}
          className="size-4 accent-neutral-900"
        />
        <Repeat className="size-4 text-neutral-500" aria-hidden />
        Repetir
      </label>
      {ligado && (
        <div className="flex flex-col gap-3 rounded-2xl bg-neutral-900/[0.03] p-3">
          <input
            type="hidden"
            name="recorrencia"
            value={JSON.stringify(regra)}
          />
          <div className="flex flex-wrap gap-1.5">
            {FREQUENCIAS.map((f) => (
              <button
                key={f.valor}
                type="button"
                aria-pressed={regra.frequencia === f.valor}
                onClick={() =>
                  setRegra({
                    frequencia: f.valor,
                    fim: regra.fim,
                    intervalo:
                      f.valor === "cada_n_dias"
                        ? 15
                        : f.valor === "cada_n_meses"
                          ? 3
                          : undefined,
                  })
                }
                className={PILULA_OPCAO}
              >
                {f.rotulo}
              </button>
            ))}
          </div>
          {comIntervalo && (
            <label className="flex items-center gap-2 text-sm">
              A cada
              <input
                type="number"
                min={1}
                max={365}
                value={regra.intervalo ?? 1}
                onChange={(e) =>
                  mudar({ intervalo: Math.max(1, Number(e.target.value) || 1) })
                }
                className={`${classeCampo} w-20`}
              />
              {regra.frequencia === "cada_n_dias" ? "dias" : "meses"}
            </label>
          )}
          {regra.frequencia === "semanal" && (
            // biome-ignore lint/a11y/useSemanticElements: grupo de botões alternáveis
            <div
              role="group"
              aria-label="Dias da semana"
              className="flex flex-wrap gap-1.5"
            >
              {DIAS.map((d, i) => {
                const marcado = regra.dias_semana?.includes(i) ?? false;
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={marcado}
                    onClick={() =>
                      mudar({
                        dias_semana: marcado
                          ? regra.dias_semana?.filter((x) => x !== i)
                          : [...(regra.dias_semana ?? []), i],
                      })
                    }
                    className={`${PILULA_OPCAO} min-w-12 justify-center`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          )}
          {regra.frequencia === "mensal" && (
            <label className="flex items-center gap-2 text-sm">
              No dia
              <input
                type="number"
                min={1}
                max={31}
                value={regra.dia_mes ?? ""}
                placeholder="—"
                onChange={(e) =>
                  mudar({
                    dia_mes: e.target.value
                      ? Math.min(31, Math.max(1, Number(e.target.value)))
                      : undefined,
                  })
                }
                className={`${classeCampo} w-20`}
              />
              do mês
            </label>
          )}
          <label
            htmlFor={`${id}-fim`}
            className="flex flex-wrap items-center gap-2 text-sm"
          >
            Até
            <input
              id={`${id}-fim`}
              type="date"
              value={regra.fim ?? ""}
              onChange={(e) => mudar({ fim: e.target.value || null })}
              className={`${classeCampo} w-44`}
            />
            <span className="text-xs text-neutral-500">(vazio: sem fim)</span>
          </label>
          <p className="text-xs text-neutral-600">
            {descreverRecorrencia(regra)}. A próxima é criada sozinha alguns
            dias antes.
          </p>
        </div>
      )}
    </div>
  );
}
