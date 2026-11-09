"use client";

import { CircleAlert, CircleCheck, Plus, Trash2 } from "lucide-react";
import type { Detalhe } from "@/components/modal-detalhe";
import type { ResultadoRateio } from "@/lib/operacoes/limpeza";
import { reais } from "@/lib/operacoes/limpeza";
import {
  textoDeCentavos,
  valorDoExtraLancado,
} from "@/lib/operacoes/limpeza-lancamento";
import { Campo, campoCelula, celula, Entrada } from "./campos";
import { type LancamentoTela, type Mudar, novaChave } from "./estado";
import { ValorComMemoria } from "./memoria";

// "Dados do mês": valor base e a composição, funcionários e os extras da
// área comum (quantidade × valor por dia, ou o valor direto).

export interface ExtraPadrao {
  descricao: string;
  /** "315,00" */
  valorDia: string;
}

export function DadosDoMes({
  l,
  mudar,
  editavel,
  r,
  extrasPadrao,
  detalhe,
}: {
  l: LancamentoTela;
  mudar: Mudar;
  editavel: boolean;
  r: ResultadoRateio;
  extrasPadrao: ExtraPadrao[];
  detalhe: (
    chave: "valor_funcionario" | "extras" | "valor_base",
  ) => Detalhe | undefined;
}) {
  const campo =
    (
      k:
        | "apontamento"
        | "valorBase"
        | "composicao"
        | "funcBase"
        | "funcAreaComum"
        | "funcRateados",
    ) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      mudar((x) => ({ ...x, [k]: v }));
    };
  const comp = r.composicao;

  return (
    <div className="flex flex-col gap-4" data-guia="op-limpeza-dados">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          rotulo="Valor base do contrato (R$)"
          ajuda={
            comp?.confere === true ? (
              <span className="inline-flex items-center gap-1 text-green-700">
                <CircleCheck className="size-3" aria-hidden /> Composição
                confere
              </span>
            ) : comp?.confere === false ? (
              <span className="inline-flex items-center gap-1 text-red-700">
                <CircleAlert className="size-3" aria-hidden /> A composição soma{" "}
                {reais(comp.valor)}
              </span>
            ) : undefined
          }
        >
          <Entrada
            numero
            value={l.valorBase}
            onChange={campo("valorBase")}
            disabled={!editavel}
            placeholder="0,00"
          />
        </Campo>
        <Campo rotulo="Valor por funcionário (R$)">
          <span className="flex min-h-9 items-center rounded-xl bg-neutral-900/[0.03] px-3 text-sm tabular-nums">
            <ValorComMemoria detalhe={detalhe("valor_funcionario")}>
              {reais(r.valorPorFuncionario)}
            </ValorComMemoria>
          </span>
        </Campo>
        <div className="sm:col-span-2">
          <Campo
            rotulo="Composição do valor base"
            ajuda="Como a planilha escreve: 38.509,83 − 8.072,68 + 1.736,79 + …"
          >
            <Entrada
              value={l.composicao}
              onChange={campo("composicao")}
              disabled={!editavel}
              maxLength={500}
            />
          </Campo>
        </div>
        <Campo rotulo="Funcionários da base">
          <Entrada
            numero
            inputMode="numeric"
            value={l.funcBase}
            onChange={campo("funcBase")}
            disabled={!editavel}
          />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Na área comum">
            <Entrada
              numero
              inputMode="numeric"
              value={l.funcAreaComum}
              onChange={campo("funcAreaComum")}
              disabled={!editavel}
            />
          </Campo>
          <Campo rotulo="Rateados">
            <Entrada
              numero
              inputMode="numeric"
              value={l.funcRateados}
              onChange={campo("funcRateados")}
              disabled={!editavel}
            />
          </Campo>
        </div>
        <div className="sm:col-span-2">
          <Campo rotulo="Apontamento (medição da empresa)">
            <Entrada
              value={l.apontamento}
              onChange={campo("apontamento")}
              disabled={!editavel}
              maxLength={200}
              placeholder="Ex.: APONTAMENTO 09.2026"
            />
          </Campo>
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold">Extras da área comum</h3>
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <caption className="sr-only">Extras da área comum</caption>
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th className={celula}>Extra</th>
                <th className={`${celula} text-right`}>Qtd.</th>
                <th className={`${celula} text-right`}>Valor por dia</th>
                <th className={`${celula} text-right`}>Valor (R$)</th>
                {editavel && (
                  <th className={celula}>
                    <span className="sr-only">Remover</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900/[0.06]">
              {l.extras.map((x, i) => {
                const comConta =
                  x.quantidade.trim() !== "" && x.valorUnitario.trim() !== "";
                const set =
                  (k: "descricao" | "quantidade" | "valorUnitario" | "valor") =>
                  (e: React.ChangeEvent<HTMLInputElement>) => {
                    const v = e.target.value;
                    mudar((t) => ({
                      ...t,
                      extras: t.extras.map((y, j) =>
                        j === i ? { ...y, [k]: v } : y,
                      ),
                    }));
                  };
                return (
                  <tr key={x.k}>
                    <td className={celula}>
                      <input
                        aria-label="Descrição do extra"
                        value={x.descricao}
                        onChange={set("descricao")}
                        disabled={!editavel}
                        maxLength={200}
                        className={`${campoCelula} w-full min-w-48 text-left`}
                      />
                    </td>
                    <td className={`${celula} text-right`}>
                      <input
                        aria-label={`Quantidade de ${x.descricao || "extra"}`}
                        inputMode="decimal"
                        value={x.quantidade}
                        onChange={set("quantidade")}
                        disabled={!editavel}
                        className={`${campoCelula} w-16`}
                      />
                    </td>
                    <td className={`${celula} text-right`}>
                      <input
                        aria-label={`Valor por dia de ${x.descricao || "extra"}`}
                        inputMode="decimal"
                        value={x.valorUnitario}
                        onChange={set("valorUnitario")}
                        disabled={!editavel}
                        className={`${campoCelula} w-24`}
                      />
                    </td>
                    <td className={`${celula} text-right tabular-nums`}>
                      {comConta || !editavel ? (
                        textoDeCentavos(valorDoExtraLancado(x))
                      ) : (
                        <input
                          aria-label={`Valor de ${x.descricao || "extra"}`}
                          inputMode="decimal"
                          value={x.valor}
                          onChange={set("valor")}
                          className={`${campoCelula} w-24`}
                        />
                      )}
                    </td>
                    {editavel && (
                      <td className={celula}>
                        <button
                          type="button"
                          onClick={() =>
                            mudar((t) => ({
                              ...t,
                              extras: t.extras.filter((_, j) => j !== i),
                            }))
                          }
                          className="grid size-8 place-items-center rounded-full text-neutral-500 hover:bg-red-500/10 hover:text-red-700"
                          aria-label={`Remover ${x.descricao || "extra"}`}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-300 font-semibold">
                <td className={celula} colSpan={3}>
                  Soma dos extras
                </td>
                <td className={`${celula} text-right tabular-nums`}>
                  <ValorComMemoria detalhe={detalhe("extras")}>
                    {reais(r.extras)}
                  </ValorComMemoria>
                </td>
                {editavel && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
        {!l.extras.length && (
          <p className="py-2 text-xs text-neutral-500">Nenhum extra no mês.</p>
        )}
        {editavel && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                mudar((t) => ({
                  ...t,
                  extras: [
                    ...t.extras,
                    {
                      k: novaChave(),
                      descricao: "",
                      quantidade: "",
                      valorUnitario: "",
                      valor: "",
                    },
                  ],
                }))
              }
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium hover:border-neutral-400"
            >
              <Plus className="size-3.5" aria-hidden /> Extra
            </button>
            {extrasPadrao.length > 0 && (
              <select
                aria-label="Adicionar um extra padrão"
                value=""
                onChange={(e) => {
                  const p = extrasPadrao[Number(e.target.value)];
                  if (!p) return;
                  mudar((t) => ({
                    ...t,
                    extras: [
                      ...t.extras,
                      {
                        k: novaChave(),
                        descricao: p.descricao,
                        quantidade: "1",
                        valorUnitario: p.valorDia,
                        valor: "",
                      },
                    ],
                  }));
                }}
                className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs"
              >
                <option value="">Extra padrão (Parâmetros)…</option>
                {extrasPadrao.map((p, i) => (
                  <option key={p.descricao} value={i}>
                    {p.descricao} · {p.valorDia}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
