"use client";

import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { salvarMetas } from "@/server/comercial/acoes/metas";

// Grade de metas do Painel comercial: indicador × mês do ano. Célula vazia
// = sem meta naquele mês (o Painel mostra o Plan vazio).

export interface LinhaGradeMetas {
  indicador: string;
  /** Nome do campo de cada mês (1 a 12). */
  campos: string[];
  nome: string;
  unidade: string;
  menorMelhor: boolean;
  /** Valor atual de cada mês, já escrito no padrão brasileiro ("" = vazio). */
  valores: string[];
}

export function GradeMetas({
  ano,
  meses,
  linhas,
}: {
  ano: number;
  meses: readonly string[];
  linhas: LinhaGradeMetas[];
}) {
  return (
    <FormAcao
      acao={salvarMetas}
      rotulo="Salvar metas"
      rotuloEnviando="Salvando…"
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="ano" value={ano} />
      <div className="-mx-2 max-h-[70vh] overflow-auto">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead className="sticky top-0 z-20 bg-white/90 backdrop-blur">
            <tr className="border-b border-neutral-200 text-xs text-neutral-500">
              <th className="sticky left-0 z-30 bg-white/90 px-2 py-2 text-left font-medium backdrop-blur">
                Indicador
              </th>
              {meses.map((m) => (
                <th key={m} className="px-1 py-2 text-right font-medium">
                  {m}/{String(ano).slice(2)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr
                key={l.indicador}
                className="border-b border-neutral-900/[0.06]"
              >
                <th
                  scope="row"
                  className="sticky left-0 z-10 min-w-56 bg-white/90 px-2 py-2 text-left font-medium backdrop-blur"
                >
                  {l.nome}
                  <span className="block text-[11px] font-normal text-neutral-500">
                    {l.unidade}
                    {l.menorMelhor ? " · menor é melhor" : ""}
                  </span>
                </th>
                {l.campos.map((campo, i) => (
                  <td key={campo} className="px-1 py-1.5">
                    <div className="w-28">
                      <input
                        name={campo}
                        inputMode="decimal"
                        defaultValue={l.valores[i]}
                        aria-label={`${l.nome}, ${meses[i]}/${ano}`}
                        className={`${classeCampo} px-2 text-right tabular-nums`}
                      />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </FormAcao>
  );
}
