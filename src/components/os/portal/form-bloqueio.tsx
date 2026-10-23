"use client";

import { useState } from "react";
import { bloquearAgenda } from "@/app/(app)/os/portal/actions";
import { classeCampo } from "@/components/estilos";
import { EnvioDaAcao, FormAcao } from "@/components/form-acao";
import { Selecao } from "@/components/selecao";

// Bloqueio por clima: um dia, vários dias ou um trecho do dia, com motivo.
// Quem já tinha horário no período vai para "Remarcar".

const MOTIVOS = ["Chuva", "Vento forte", "Tempestade", "Manutenção no telhado"];

export function FormBloqueio({
  agendas,
  hoje,
}: {
  agendas: { id: string; nome: string }[];
  /** aaaa-mm-dd de Brasília. */
  hoje: string;
}) {
  const [diaInteiro, setDiaInteiro] = useState(true);
  const [motivo, setMotivo] = useState("");
  return (
    <FormAcao
      acao={bloquearAgenda}
      rotulo="Bloquear"
      rotuloEnviando="Bloqueando…"
      confirmar="Bloquear este período? Quem já tinha horário vai para a lista Remarcar."
      botaoNoFim={false}
      className="flex flex-col gap-4"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="b-agenda"
            className="text-xs font-medium text-neutral-600"
          >
            Agenda *
          </label>
          <Selecao
            id="b-agenda"
            name="agenda"
            obrigatorio
            valorInicial={agendas.length === 1 ? agendas[0]?.id : ""}
            opcoes={agendas.map((a) => ({ valor: a.id, rotulo: a.nome }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="b-inicio"
            className="text-xs font-medium text-neutral-600"
          >
            Dia *
          </label>
          <input
            id="b-inicio"
            name="data_inicio"
            type="date"
            required
            min={hoje}
            defaultValue={hoje}
            className={classeCampo}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="b-fim"
            className="text-xs font-medium text-neutral-600"
          >
            Até o dia (vários dias)
          </label>
          <input
            id="b-fim"
            name="data_fim"
            type="date"
            min={hoje}
            className={classeCampo}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            name="dia_inteiro"
            checked={diaInteiro}
            onChange={(e) => setDiaInteiro(e.target.checked)}
            className="size-4 accent-neutral-900"
          />
          Dia inteiro
        </label>
        {!diaInteiro && (
          <>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="b-das"
                className="text-xs font-medium text-neutral-600"
              >
                Das *
              </label>
              <input
                id="b-das"
                name="hora_inicio"
                type="time"
                required
                className={classeCampo}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="b-ate"
                className="text-xs font-medium text-neutral-600"
              >
                Até as *
              </label>
              <input
                id="b-ate"
                name="hora_fim"
                type="time"
                required
                className={classeCampo}
              />
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="b-motivo"
          className="text-xs font-medium text-neutral-600"
        >
          Motivo *
        </label>
        <input
          id="b-motivo"
          name="motivo"
          required
          minLength={3}
          maxLength={200}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className={classeCampo}
        />
        <div className="flex flex-wrap gap-1.5">
          {MOTIVOS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMotivo(m)}
              className="rounded-full bg-neutral-900/[0.05] px-3 py-1 text-xs text-neutral-700 transition hover:bg-neutral-900/10"
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <EnvioDaAcao />
    </FormAcao>
  );
}
