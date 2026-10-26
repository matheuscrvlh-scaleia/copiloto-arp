"use client";

import { CalendarClock } from "lucide-react";
import { useEffect, useId, useState, useTransition } from "react";
import { classeCampo } from "@/components/estilos";
import { hojeEmBrasilia, paraBrasilia } from "@/lib/os/tempo";
import { type HorariosDoDia, horariosDoDia } from "@/server/os/acoes/chamados";
import { PILULA_OPCAO } from "./repetir";

// Reservar horário: a categoria tem agenda (ex.: acesso ao telhado). A
// pessoa escolhe o dia e um horário livre; a reserva sai junto com o
// chamado (o banco confere de novo limite, choque e bloqueio).

export function Horario({
  agendaId,
  nome,
}: {
  agendaId: string;
  nome: string;
}) {
  const id = useId();
  const [dia, setDia] = useState(() => hojeEmBrasilia(new Date()));
  const [dados, setDados] = useState<HorariosDoDia | null>(null);
  const [escolhido, setEscolhido] = useState("");
  const [buscando, iniciar] = useTransition();

  useEffect(() => {
    setEscolhido("");
    iniciar(async () => setDados(await horariosDoDia(agendaId, dia)));
  }, [agendaId, dia]);

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 flex items-center gap-2 text-sm font-medium">
        <CalendarClock className="size-4 text-neutral-500" aria-hidden />
        Reservar horário · {nome}
      </legend>
      <input type="hidden" name="agenda_id" value={escolhido ? agendaId : ""} />
      <input type="hidden" name="horario" value={escolhido} />
      <label
        htmlFor={`${id}-dia`}
        className="flex flex-wrap items-center gap-2 text-sm"
      >
        Dia
        <input
          id={`${id}-dia`}
          type="date"
          min={hojeEmBrasilia(new Date())}
          value={dia}
          onChange={(e) => e.target.value && setDia(e.target.value)}
          className={`${classeCampo} w-44`}
        />
      </label>
      {dados?.orientacao && (
        <p className="text-xs text-neutral-600">{dados.orientacao}</p>
      )}
      <div aria-live="polite" className="flex flex-wrap gap-1.5">
        {buscando ? (
          <span className="text-sm text-neutral-500">Buscando horários…</span>
        ) : !dados?.livres.length ? (
          <span className="text-sm text-neutral-500">
            Nenhum horário livre neste dia. Escolha outro.
          </span>
        ) : (
          dados.livres.map((h) => {
            const valor = `${h.inicio}|${h.fim}`;
            return (
              <button
                key={h.inicio}
                type="button"
                aria-pressed={escolhido === valor}
                onClick={() => setEscolhido(escolhido === valor ? "" : valor)}
                className={PILULA_OPCAO}
              >
                {paraBrasilia(new Date(h.inicio)).hora} –{" "}
                {paraBrasilia(new Date(h.fim)).hora}
              </button>
            );
          })
        )}
      </div>
    </fieldset>
  );
}
