"use client";

import { useState } from "react";
import { Selecao } from "@/components/selecao";

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";

const FORMAS = [
  { valor: "por_funcionario", rotulo: "Por funcionário" },
  { valor: "rateado", rotulo: "Rateado entre funcionários" },
];

const DIVISOES = [
  { valor: "ativos", rotulo: "Todos os ativos" },
  { valor: "ativos_nao_afastados", rotulo: "Ativos não afastados" },
  { valor: "departamento", rotulo: "Um departamento" },
];

/**
 * Forma de cálculo do benefício. No rateado, o valor do bloco "Valor" é o
 * total do mês, dividido entre quem entra na divisão na competência.
 */
export function CamposRateio({
  forma,
  dividirEntre,
  departamentoId,
  departamentos,
}: {
  forma: string;
  dividirEntre: string | null;
  departamentoId: string | null;
  departamentos: { valor: string; rotulo: string }[];
}) {
  const [f, setF] = useState(forma);
  const [entre, setEntre] = useState(dividirEntre ?? "ativos");
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <label className={rotulo}>
        Forma de cálculo
        <Selecao
          name="forma_calculo"
          rotulo="Forma de cálculo"
          valor={f}
          aoMudar={setF}
          opcoes={FORMAS}
        />
      </label>
      {f === "rateado" && (
        <label className={rotulo}>
          Dividir entre
          <Selecao
            name="dividir_entre"
            rotulo="Dividir entre"
            valor={entre}
            aoMudar={setEntre}
            opcoes={DIVISOES}
          />
        </label>
      )}
      {f === "rateado" && entre === "departamento" && (
        <label className={rotulo}>
          Departamento
          <Selecao
            name="dividir_departamento_id"
            rotulo="Departamento da divisão"
            obrigatorio
            valorInicial={departamentoId ?? ""}
            opcoes={departamentos}
          />
        </label>
      )}
      {f === "rateado" && (
        <p className="text-xs text-neutral-500 sm:col-span-3">
          Rateado: o valor abaixo é o total do mês, dividido pelo número de
          pessoas da divisão em cada competência (ex.: R$ 1.200,00 ÷ 45 = R$
          26,67 no custo de cada um). Não é preciso vincular ninguém.
        </p>
      )}
    </div>
  );
}
