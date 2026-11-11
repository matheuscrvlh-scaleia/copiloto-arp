"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { EnvioDaAcao, FormAcao } from "@/components/form-acao";
import { formatarData, formatarMoeda } from "@/lib/formato";
import { formatarM3, rotuloMes } from "@/lib/operacoes/agua-formato";
import { corrigirContaAgua } from "@/server/operacoes/acoes/agua-conta";
import type { ContaImportada } from "@/server/operacoes/importacoes-dados";
import { CamposConta, paraCampo } from "../agua/campos-conta";
import { BOTAO_SECUNDARIO } from "../agua/estilos";

// A conta da concessionária gravada pela importação: os campos como dado e,
// para quem importa a água, "Corrigir" (o mês fica; para trocar, desfazer).

function Campo({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-neutral-500">{rotulo}</dt>
      <dd className="text-sm tabular-nums">{valor}</dd>
    </div>
  );
}

const ou = (v: string | null) => v ?? "—";

export function ContaImportadaVista({
  importacao,
  conta,
  podeEditar,
}: {
  importacao: string;
  conta: ContaImportada;
  podeEditar: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const pode = podeEditar && conta.vigente;

  if (editando)
    return (
      <FormAcao
        acao={corrigirContaAgua}
        rotulo="Salvar correção"
        aoConcluir={() => setEditando(false)}
        botaoNoFim={false}
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="importacao" value={importacao} />
        <CamposConta
          mesTravado
          valores={{
            referencia: conta.referencia.slice(0, 7),
            matricula: conta.matricula,
            vencimento: conta.vencimento,
            data_anterior: conta.dataAnterior,
            data_atual: conta.dataAtual,
            leitura_anterior: paraCampo(conta.leituraAnterior),
            leitura_atual: paraCampo(conta.leituraAtual),
            consumo_m3: paraCampo(conta.consumoM3),
            valor_agua: paraCampo(conta.valorAgua, 2),
            valor_esgoto: paraCampo(conta.valorEsgoto, 2),
            total: paraCampo(conta.total, 2),
            observacao: conta.observacao,
          }}
        />
        <div className="flex flex-wrap gap-2">
          <EnvioDaAcao />
          <button
            type="button"
            className={BOTAO_SECUNDARIO}
            onClick={() => setEditando(false)}
          >
            Cancelar
          </button>
        </div>
      </FormAcao>
    );

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Campo rotulo="Mês" valor={rotuloMes(conta.referencia)} />
        <Campo rotulo="Matrícula" valor={conta.matricula} />
        <Campo
          rotulo="Vencimento"
          valor={conta.vencimento ? formatarData(conta.vencimento) : "—"}
        />
        <Campo rotulo="Consumo" valor={formatarM3(conta.consumoM3)} />
        <Campo
          rotulo="Leituras"
          valor={`${ou(paraCampo(conta.leituraAnterior) || null)} → ${ou(paraCampo(conta.leituraAtual) || null)}`}
        />
        <Campo
          rotulo="Período"
          valor={
            conta.dataAnterior || conta.dataAtual
              ? `${conta.dataAnterior ? formatarData(conta.dataAnterior) : "—"} a ${conta.dataAtual ? formatarData(conta.dataAtual) : "—"}`
              : "—"
          }
        />
        <Campo
          rotulo="Água"
          valor={
            conta.valorAgua === null ? "—" : formatarMoeda(conta.valorAgua)
          }
        />
        <Campo
          rotulo="Esgoto"
          valor={
            conta.valorEsgoto === null ? "—" : formatarMoeda(conta.valorEsgoto)
          }
        />
        <Campo
          rotulo="Total"
          valor={<strong>{formatarMoeda(conta.total)}</strong>}
        />
        {conta.observacao && (
          <div className="col-span-full">
            <Campo rotulo="Observação" valor={conta.observacao} />
          </div>
        )}
      </dl>
      {!conta.vigente && (
        <p className="text-xs text-neutral-500">
          Esta conta não vale mais (prévia, desfeita ou substituída por outra da
          mesma matrícula e mês).
        </p>
      )}
      {pode && (
        <div>
          <button
            type="button"
            className={BOTAO_SECUNDARIO}
            onClick={() => setEditando(true)}
          >
            <Pencil className="size-4" aria-hidden />
            Corrigir a conta
          </button>
        </div>
      )}
    </div>
  );
}
