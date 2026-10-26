"use client";

import { CalendarClock, MessageCircle } from "lucide-react";
import { useState } from "react";
import { EnvioDaAcao, FormAcao } from "@/components/form-acao";
import type { DiaDaEscolha } from "@/lib/os/portal";
import {
  cancelarAgendamento,
  remarcarAgendamento,
} from "@/server/os/acoes/portal";
import { EscolhaHorario } from "./publico/campos";

// Ações de um horário: avisar pelo WhatsApp (mensagem "remarcar"), marcar
// outro horário (a reserva confere limite e choque) ou cancelar.

const PILULA =
  "inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 transition hover:border-neutral-400";

export function AcoesDoHorario({
  agendamento,
  whatsapp,
  dias,
}: {
  agendamento: string;
  /** Link do WhatsApp com a mensagem pronta (só para quem vai remarcar). */
  whatsapp?: string;
  /** Dias livres da agenda (para remarcar). */
  dias?: DiaDaEscolha[];
}) {
  const [escolhendo, setEscolhendo] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {whatsapp && (
          <a
            href={whatsapp}
            target="_blank"
            rel="noreferrer"
            className={PILULA}
          >
            <MessageCircle className="size-3.5" aria-hidden />
            Avisar pelo WhatsApp
          </a>
        )}
        {dias && (
          <button
            type="button"
            onClick={() => setEscolhendo((v) => !v)}
            aria-expanded={escolhendo}
            className={PILULA}
          >
            <CalendarClock className="size-3.5" aria-hidden />
            Marcar outro horário
          </button>
        )}
        <FormAcao
          acao={cancelarAgendamento}
          variante="perigo"
          rotulo="Cancelar horário"
          rotuloEnviando="Cancelando…"
          confirmar="Cancelar este horário? A loja vê o cancelamento no portal."
        >
          <input type="hidden" name="agendamento" value={agendamento} />
        </FormAcao>
      </div>
      {escolhendo && dias && (
        <FormAcao
          acao={remarcarAgendamento}
          rotulo="Remarcar"
          rotuloEnviando="Remarcando…"
          botaoNoFim={false}
          className="flex flex-col gap-3 rounded-2xl bg-white/60 p-4"
        >
          <input type="hidden" name="agendamento" value={agendamento} />
          <EscolhaHorario dias={dias} />
          <EnvioDaAcao />
        </FormAcao>
      )}
    </div>
  );
}
