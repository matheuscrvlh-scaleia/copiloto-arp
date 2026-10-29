"use client";

import {
  CircleCheck,
  Flag,
  Pause,
  Play,
  Timer,
  TimerReset,
} from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { relogio } from "@/lib/os/ordem";
import { concluirOS, iniciarTempo, pausarTempo } from "@/server/os/acoes/ordem";
import { aviso, botao } from "./estilos";
import type { EstadoOS } from "./tipos";

// Cronômetro do técnico: uma barra presa no topo do detalhe enquanto rola.
// Iniciar ao chegar, Pausar ou Finalizar ao sair. O sistema preenche as
// sessões sozinho; Finalizar ainda propõe concluir a OS quando nada impede.

const INICIAL: EstadoOS = {};
const TAMANHO = "min-h-11 px-4 text-sm";

export function Cronometro({
  ordemId,
  desde,
  bloqueio,
  outrosRodando,
}: {
  ordemId: string;
  /** Início da minha sessão rodando (ISO); null se parado. */
  desde: string | null;
  /** Por que não dá para iniciar agora (OS concluída, sem permissão). */
  bloqueio: string | null;
  /** Outros técnicos com o cronômetro rodando nesta OS. */
  outrosRodando: number;
}) {
  const [inicio, iniciar, iniciando] = useActionState(iniciarTempo, INICIAL);
  const [pausa, pausar, pausando] = useActionState(pausarTempo, INICIAL);
  const [conclusao, concluir, concluindo] = useActionState(concluirOS, INICIAL);
  const [agora, setAgora] = useState<Date | null>(null);
  const [proposta, setProposta] = useState(false);
  // A última volta de Iniciar ou Pausar, na ordem em que aconteceram.
  const [ultima, setUltima] = useState<EstadoOS | null>(null);

  // O relógio só existe no navegador (no servidor a hora seria outra).
  useEffect(() => {
    if (!desde) return;
    setAgora(new Date());
    const t = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(t);
  }, [desde]);

  useEffect(() => {
    if (inicio.ok || inicio.erro) setUltima(inicio);
  }, [inicio]);

  useEffect(() => {
    if (pausa.ok || pausa.erro) setUltima(pausa);
    setProposta(pausa.concluir === true);
  }, [pausa]);

  const ocupado = iniciando || pausando;

  return (
    <div className="flex flex-col gap-2">
      {desde ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[1.5rem] bg-neutral-900 py-2.5 pr-2.5 pl-4 text-white shadow-[0_12px_32px_-16px_rgb(0_0_0/0.6)]">
          <div className="flex items-center gap-3">
            <span className="relative flex size-3" aria-hidden>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-marca opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-3 rounded-full bg-marca" />
            </span>
            <p className="flex items-baseline gap-2">
              <span className="text-xs text-[rgb(255_255_255/0.6)]">
                Seu tempo
              </span>
              <span
                className="text-2xl font-semibold tabular-nums tracking-tight"
                aria-live="off"
              >
                {agora ? relogio(new Date(desde), agora) : "--:--:--"}
              </span>
            </p>
          </div>
          <div className="flex gap-2 max-sm:w-full">
            <form action={pausar} className="max-sm:flex-1">
              <input type="hidden" name="ordem_id" value={ordemId} />
              <input type="hidden" name="finalizar" value="0" />
              <button
                type="submit"
                disabled={ocupado}
                className={`flex w-full items-center justify-center gap-2 rounded-full bg-[rgb(255_255_255/0.12)] font-semibold text-white transition hover:bg-[rgb(255_255_255/0.2)] disabled:opacity-60 ${TAMANHO}`}
              >
                <Pause className="size-4" aria-hidden />
                {pausando ? "Salvando…" : "Pausar"}
              </button>
            </form>
            <form action={pausar} className="max-sm:flex-1">
              <input type="hidden" name="ordem_id" value={ordemId} />
              <input type="hidden" name="finalizar" value="1" />
              <button
                type="submit"
                disabled={ocupado}
                className={`flex w-full items-center justify-center gap-2 rounded-full bg-marca font-semibold text-[#06140a] transition hover:brightness-105 disabled:opacity-60 ${TAMANHO}`}
              >
                <Flag className="size-4" aria-hidden />
                Finalizar
              </button>
            </form>
          </div>
        </div>
      ) : (
        <form
          action={iniciar}
          className="vidro flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[1.5rem] py-2.5 pr-2.5 pl-4"
        >
          <input type="hidden" name="ordem_id" value={ordemId} />
          <p className="flex min-w-0 flex-1 items-center gap-2.5 text-sm text-neutral-600">
            <Timer className="size-4 shrink-0 text-neutral-500" aria-hidden />
            <span className="min-w-0">
              {bloqueio ?? "Inicie ao chegar no local; pause na saída."}
            </span>
          </p>
          <button
            type="submit"
            disabled={ocupado || bloqueio !== null}
            className={`flex items-center justify-center gap-2 rounded-full bg-marca font-semibold text-[#06140a] shadow-[0_8px_24px_-8px_rgb(88_192_105/0.7)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none max-sm:w-full ${TAMANHO}`}
          >
            <Play className="size-4" aria-hidden />
            {iniciando ? "Iniciando…" : "Iniciar"}
          </button>
        </form>
      )}

      {outrosRodando > 0 && (
        <p className="flex items-center gap-2 px-2 text-xs text-neutral-600">
          <TimerReset className="size-3.5" aria-hidden />
          {outrosRodando === 1
            ? "Outro técnico está com o cronômetro rodando nesta OS."
            : `${outrosRodando} técnicos estão com o cronômetro rodando nesta OS.`}
        </p>
      )}

      {ultima && !proposta && (
        <p
          role={ultima.erro ? "alert" : "status"}
          className={ultima.erro ? aviso.erro : aviso.ok}
        >
          {ultima.erro ?? ultima.ok}
          {pausa === ultima && pausa.motivo && (
            <span className="mt-1 block text-amber-900">
              Para concluir: {pausa.motivo}
            </span>
          )}
        </p>
      )}

      {proposta && !conclusao.ok && (
        <div
          aria-live="polite"
          className="flex flex-col gap-3 rounded-[1.5rem] border border-green-700/20 bg-green-50 p-4 text-sm text-green-700"
        >
          <p className="flex items-start gap-2 font-medium">
            <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            {pausa.ok} Concluir a OS agora?
          </p>
          {conclusao.erro && (
            <p role="alert" className="text-red-700">
              {conclusao.erro}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <form action={concluir}>
              <input type="hidden" name="ordem_id" value={ordemId} />
              <button
                type="submit"
                disabled={concluindo}
                className={botao.primario}
              >
                {concluindo ? "Concluindo…" : "Concluir a OS"}
              </button>
            </form>
            <button
              type="button"
              onClick={() => setProposta(false)}
              className={botao.secundario}
            >
              Agora não
            </button>
          </div>
        </div>
      )}
      {conclusao.ok && (
        <output className={`block ${aviso.ok}`}>{conclusao.ok}</output>
      )}
    </div>
  );
}
