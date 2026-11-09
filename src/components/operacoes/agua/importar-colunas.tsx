"use client";

import { Columns3 } from "lucide-react";
import { useId, useState } from "react";
import { classeCampo } from "@/components/estilos";
import {
  CAMPOS_AGUA,
  type CampoAgua,
  LISTA_CAMPOS,
} from "@/lib/operacoes/agua-formato";
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO } from "./estilos";

// Modelo de importação (spec 4.4): quando a planilha não tem as colunas que
// o sistema reconhece pelo título, a pessoa diz uma vez qual coluna é qual
// campo. Quem edita Parâmetros pode guardar como modelo: o próximo arquivo
// com o mesmo layout já entra sem perguntar.

export function FormColunas({
  colunas,
  aoLer,
  aoCancelar,
}: {
  colunas: {
    arquivo: string;
    titulos: string[];
    faltam: CampoAgua[];
    achadas: Partial<Record<CampoAgua, string>>;
    podeSalvarModelo: boolean;
  };
  aoLer: (mapa: Partial<Record<CampoAgua, number>>, salvar: boolean) => void;
  aoCancelar: () => void;
}) {
  const id = useId();
  const inicial = Object.fromEntries(
    Object.entries(colunas.achadas).map(([c, t]) => [
      c,
      colunas.titulos.indexOf(t ?? ""),
    ]),
  ) as Partial<Record<CampoAgua, number>>;
  const [mapa, setMapa] = useState(inicial);
  const [salvar, setSalvar] = useState(colunas.podeSalvarModelo);
  const faltam = LISTA_CAMPOS.filter(
    (c) => CAMPOS_AGUA[c].obrigatorio && (mapa[c] === undefined || mapa[c] < 0),
  );
  const repetidas = new Set(
    Object.values(mapa).filter(
      (i, n, todos) => i !== undefined && i >= 0 && todos.indexOf(i) !== n,
    ),
  );

  return (
    <form
      data-guia="op-agua-colunas"
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (faltam.length || repetidas.size) return;
        const limpo = Object.fromEntries(
          Object.entries(mapa).filter(([, i]) => i !== undefined && i >= 0),
        );
        aoLer(limpo, salvar);
      }}
    >
      <div className="flex items-start gap-3 rounded-2xl bg-amber-400/15 px-4 py-3 text-sm text-amber-900">
        <Columns3 className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          Não reconheci todas as colunas de <b>{colunas.arquivo}</b>. Diga qual
          coluna da planilha é cada campo. Faltam:{" "}
          {colunas.faltam.map((c) => CAMPOS_AGUA[c].rotulo).join(", ")}.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {LISTA_CAMPOS.map((c) => (
          <label key={c} className="flex flex-col gap-1 text-sm">
            <span className="font-medium">
              {CAMPOS_AGUA[c].rotulo}
              {CAMPOS_AGUA[c].obrigatorio && (
                <span className="text-red-700" aria-hidden>
                  {" "}
                  *
                </span>
              )}
            </span>
            <select
              className={classeCampo}
              required={CAMPOS_AGUA[c].obrigatorio}
              value={mapa[c] ?? -1}
              onChange={(e) =>
                setMapa((m) => ({ ...m, [c]: Number(e.target.value) }))
              }
              aria-invalid={
                mapa[c] !== undefined && repetidas.has(mapa[c])
                  ? true
                  : undefined
              }
            >
              <option value={-1}>
                {CAMPOS_AGUA[c].obrigatorio ? "Escolha a coluna" : "Não tem"}
              </option>
              {colunas.titulos.map((t, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a posição é a coluna
                <option key={i} value={i}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {repetidas.size > 0 && (
        <p role="alert" className="text-sm text-red-700">
          A mesma coluna foi escolhida para dois campos.
        </p>
      )}
      {colunas.podeSalvarModelo && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={salvar}
            onChange={(e) => setSalvar(e.target.checked)}
            className="size-4 accent-neutral-900"
            aria-describedby={`${id}-modelo`}
          />
          Guardar como modelo de importação
          <span id={`${id}-modelo`} className="text-xs text-neutral-500">
            (Parâmetros › Água; vale para os próximos arquivos)
          </span>
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={faltam.length > 0 || repetidas.size > 0}
          className={BOTAO_PRIMARIO}
        >
          Ler de novo com estas colunas
        </button>
        <button type="button" onClick={aoCancelar} className={BOTAO_SECUNDARIO}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
