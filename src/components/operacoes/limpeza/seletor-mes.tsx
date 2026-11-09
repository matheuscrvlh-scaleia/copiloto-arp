"use client";

import { CalendarDays, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Dialogo } from "@/components/calendario/dialogo";
import { classeCampo } from "@/components/estilos";
import { notificar } from "@/components/notificacoes";
import { criarMes } from "@/server/operacoes/acoes/limpeza";

// Filtro do mês (padrão: o mais recente) e "Novo mês": começa copiando o
// mês anterior (spec 4.8) ou do zero, com os padrões dos Parâmetros.

const BASE = "/operacoes/limpeza";

export function SeletorDeMes({
  meses,
  atual,
  podeLancar,
  sugestao,
}: {
  meses: { referencia: string; rotulo: string }[];
  atual: string | null;
  podeLancar: boolean;
  /** Próximo mês sem lançamento ("aaaa-mm"). */
  sugestao: string;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [mes, setMes] = useState(sugestao);
  const [copiar, setCopiar] = useState(meses.length > 0);
  const [criando, iniciar] = useTransition();
  const ir = (ref: string) => router.push(`${BASE}?mes=${ref.slice(0, 7)}`);

  return (
    <div
      data-guia="filtros"
      className="vidro flex flex-wrap items-center gap-2 rounded-[1.5rem] p-2"
    >
      {meses.length > 0 && (
        <label className="flex items-center gap-2 pl-2 text-sm">
          <CalendarDays className="size-4 text-neutral-500" aria-hidden />
          <span className="text-neutral-600">Mês</span>
          <select
            data-guia="op-limpeza-mes"
            value={atual ?? ""}
            onChange={(e) => ir(e.target.value)}
            className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm"
          >
            {meses.map((m) => (
              <option key={m.referencia} value={m.referencia}>
                {m.rotulo}
              </option>
            ))}
          </select>
        </label>
      )}
      {podeLancar && (
        <button
          type="button"
          data-guia="op-limpeza-novo-mes"
          onClick={() => setAberto(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-800"
        >
          <Plus className="size-4" aria-hidden /> Novo mês
        </button>
      )}

      <Dialogo
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Novo mês do rateio"
        rodape={
          <>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium hover:border-neutral-400"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={criando || !/^\d{4}-\d{2}$/.test(mes)}
              onClick={() =>
                iniciar(async () => {
                  const r = await criarMes({ referencia: mes, copiar });
                  if (r.erro) notificar("erro", r.erro);
                  else if (r.ok) notificar("ok", r.ok);
                  if (r.referencia) {
                    setAberto(false);
                    ir(r.referencia);
                  }
                })
              }
              className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
            >
              {criando ? "Criando…" : "Criar"}
            </button>
          </>
        }
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-neutral-700">
            Mês de referência
          </span>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className={classeCampo}
            required
          />
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-neutral-700">
            Começar com
          </legend>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="comeco"
              checked={copiar}
              onChange={() => setCopiar(true)}
              disabled={!meses.length}
              className="mt-1 accent-neutral-900"
            />
            <span>
              Os valores do mês anterior
              <span className="block text-xs text-neutral-500">
                Valor base, funcionários, extras, minutos, contrato e equipe.
                Depois é só ajustar o que mudou.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="comeco"
              checked={!copiar}
              onChange={() => setCopiar(false)}
              className="mt-1 accent-neutral-900"
            />
            <span>
              Do zero
              <span className="block text-xs text-neutral-500">
                Funcionários e extras padrão dos Parâmetros, minutos zerados.
              </span>
            </span>
          </label>
        </fieldset>
      </Dialogo>
    </div>
  );
}
