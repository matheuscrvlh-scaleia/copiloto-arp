"use client";

import { useState } from "react";
import { classeCampo } from "@/components/estilos";
import { type Acao, EnvioDaAcao, FormAcao } from "@/components/form-acao";
import { fimDoMes, formatarMes, formatarNumero } from "@/lib/formato";
import { type ValorLancado, valorLancadoNoMes } from "@/lib/rh/custo";

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";
const valorBr = (v: number) => formatarNumero(v, 2);

export interface PessoaDoBeneficio {
  colaborador_id: string;
  nome: string;
  desde: string;
  ate: string | null;
}

/**
 * Valores do mês de um benefício que varia por mês: escolhe a competência,
 * digita (ou importa, ou copia) o valor de cada pessoa e salva. Cada mês é um
 * lançamento à parte; sem lançamento, o custo repete o último anterior.
 */
export function ValoresDoMes({
  beneficioId,
  pessoas,
  lancados,
  mesInicial,
  salvar,
  importar,
}: {
  beneficioId: string;
  pessoas: PessoaDoBeneficio[];
  /** Lançamentos deste benefício, de todas as competências. */
  lancados: (ValorLancado & { colaborador_id: string })[];
  /** "aaaa-mm" */
  mesInicial: string;
  salvar: Acao;
  importar: Acao;
}) {
  const [mes, setMes] = useState(mesInicial);
  const competencia = `${mes}-01`;

  // Quem recebe no mês (uma linha por pessoa, mesmo com vínculos repetidos).
  const doMes = [
    ...new Map(
      pessoas
        .filter(
          (p) =>
            p.desde <= fimDoMes(competencia) &&
            (p.ate === null || p.ate >= competencia),
        )
        .map((p) => [p.colaborador_id, p]),
    ).values(),
  ].sort((a, b) => a.nome.localeCompare(b.nome));
  const lancadosDe = (id: string) =>
    lancados.filter((l) => l.colaborador_id === id);
  const noMes = (id: string) =>
    lancadosDe(id).find((l) => l.competencia === competencia)?.valor ?? null;
  const antes = (id: string) =>
    valorLancadoNoMes(
      lancadosDe(id).filter((l) => l.competencia < competencia),
      competencia,
    );

  // Campos controlados; voltam ao que está gravado quando muda o mês ou
  // chegam dados novos (depois de salvar ou importar).
  const gravado = Object.fromEntries(
    doMes.map((p) => {
      const v = noMes(p.colaborador_id);
      return [p.colaborador_id, v === null ? "" : valorBr(v)];
    }),
  );
  const assinatura = `${competencia}|${JSON.stringify(gravado)}`;
  const [base, setBase] = useState(assinatura);
  const [valores, setValores] = useState(gravado);
  const [copiado, setCopiado] = useState(false);
  if (base !== assinatura) {
    setBase(assinatura);
    setValores(gravado);
    setCopiado(false);
  }

  const comAnterior = doMes.filter(
    (p) => antes(p.colaborador_id).valor !== null,
  );
  const lancadosNoMes = doMes.filter(
    (p) => noMes(p.colaborador_id) !== null,
  ).length;

  function copiarAnterior() {
    setValores((atual) => {
      const novo = { ...atual };
      for (const p of comAnterior) {
        const v = antes(p.colaborador_id).valor;
        if (v !== null) novo[p.colaborador_id] = valorBr(v);
      }
      return novo;
    });
    setCopiado(true);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-neutral-900/[0.03] p-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Valores do mês</p>
          <p className="text-xs text-neutral-500">
            {lancadosNoMes} de {doMes.length}{" "}
            {doMes.length === 1 ? "pessoa" : "pessoas"} com valor lançado em{" "}
            {formatarMes(competencia)}. Lançar ou alterar um mês não muda os
            anteriores.
          </p>
        </div>
        <label className={rotulo}>
          Competência
          <input
            type="month"
            value={mes}
            required
            onChange={(e) => e.target.value && setMes(e.target.value)}
            className={`${classeCampo} w-44`}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <FormAcao
          acao={importar}
          rotulo="Importar planilha"
          rotuloEnviando="Importando…"
          variante="secundario"
          className="flex flex-wrap items-center gap-3"
        >
          <input type="hidden" name="beneficio_id" value={beneficioId} />
          <input type="hidden" name="competencia" value={mes} />
          <input
            type="file"
            name="arquivo"
            required
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            aria-label={`Planilha com os valores de ${formatarMes(competencia)} (.xlsx)`}
            className="max-w-64 text-xs file:mr-3 file:rounded-full file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-neutral-200"
          />
        </FormAcao>
        <button
          type="button"
          onClick={copiarAnterior}
          disabled={comAnterior.length === 0}
          title={
            comAnterior.length === 0
              ? `Ninguém tem valor lançado antes de ${formatarMes(competencia)}`
              : undefined
          }
          className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Copiar do mês anterior
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        Planilha .xlsx com as colunas CPF, nome e valor. O CPF não é gravado:
        cada linha vale pela pessoa de mesmo nome entre quem recebe o benefício
        no mês.
      </p>

      {doMes.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Ninguém recebe este benefício em {formatarMes(competencia)}.
        </p>
      ) : (
        <FormAcao
          acao={salvar}
          rotulo="Salvar valores"
          botaoNoFim={false}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="beneficio_id" value={beneficioId} />
          <input type="hidden" name="competencia" value={mes} />
          <ul className="flex flex-col divide-y divide-neutral-900/[0.06] text-sm">
            {doMes.map((p) => {
              const anterior = antes(p.colaborador_id);
              const vazio = (valores[p.colaborador_id] ?? "") === "";
              return (
                <li
                  key={p.colaborador_id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2"
                >
                  <div className="min-w-56 flex-1">
                    <p className="font-medium">{p.nome}</p>
                    {vazio && (
                      <p className="text-xs text-amber-700">
                        {anterior.valor !== null
                          ? anterior.aviso
                          : "Sem valor lançado: fica fora do custo do mês"}
                      </p>
                    )}
                  </div>
                  <input
                    type="hidden"
                    name="colaborador_id"
                    value={p.colaborador_id}
                  />
                  <input
                    name="valor"
                    inputMode="decimal"
                    aria-label={`Valor de ${p.nome} em ${formatarMes(competencia)} (R$)`}
                    value={valores[p.colaborador_id] ?? ""}
                    onChange={(e) =>
                      setValores((v) => ({
                        ...v,
                        [p.colaborador_id]: e.target.value,
                      }))
                    }
                    placeholder={
                      anterior.valor !== null ? valorBr(anterior.valor) : "R$"
                    }
                    className={`${classeCampo} w-32 text-right tabular-nums`}
                  />
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <EnvioDaAcao />
            {copiado && (
              <span className="text-xs text-sky-800">
                Valores copiados do último mês lançado. Confira e salve.
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500">
            Campo vazio apaga o lançamento do mês: o custo volta a repetir o
            último valor lançado antes dele.
          </p>
        </FormAcao>
      )}
    </div>
  );
}
