"use client";

import { CircleCheck, Flag, Pause, Play, TimerReset } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { relogio } from "@/lib/os/ordem";
import { concluirOS, iniciarTempo, pausarTempo } from "@/server/os/ordem-acoes";
import { aviso, botao } from "./estilos";
import type { EstadoOS } from "./tipos";

// Cronômetro do técnico no celular: Iniciar ao chegar, Pausar ou Finalizar
// ao sair. O sistema preenche as sessões sozinho; Finalizar ainda propõe
// concluir a OS quando nada impede.

const INICIAL: EstadoOS = {};

export function Cronometro({
  chamadoId,
  desde,
  bloqueio,
  outrosRodando,
  compacto = false,
}: {
  chamadoId: string;
  /** Início da minha sessão rodando (ISO); null se parado. */
  desde: string | null;
  /** Por que não dá para iniciar agora (OS concluída, sem permissão). */
  bloqueio: string | null;
  /** Outros técnicos com o cronômetro rodando nesta OS. */
  outrosRodando: number;
  compacto?: boolean;
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
  const tamanho = compacto ? "px-4 py-2.5 text-sm" : "px-5 py-4 text-base";

  return (
    <div className="flex flex-col gap-3">
      {desde ? (
        <div
          className={`flex flex-col gap-3 rounded-[1.5rem] bg-neutral-900 p-4 text-white ${compacto ? "" : "md:flex-row md:items-center md:justify-between md:p-5"}`}
        >
          <div className="flex items-center gap-3">
            <span className="relative flex size-3" aria-hidden>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-marca opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-3 rounded-full bg-marca" />
            </span>
            <div>
              <p className="text-xs text-[rgb(255_255_255/0.6)]">
                Seu tempo nesta OS
              </p>
              <p
                className={`font-semibold tabular-nums tracking-tight ${compacto ? "text-2xl" : "text-4xl"}`}
                aria-live="off"
              >
                {agora ? relogio(new Date(desde), agora) : "--:--:--"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex">
            <form action={pausar}>
              <input type="hidden" name="chamado_id" value={chamadoId} />
              <input type="hidden" name="finalizar" value="0" />
              <button
                type="submit"
                disabled={ocupado}
                className={`flex w-full items-center justify-center gap-2 rounded-full bg-[rgb(255_255_255/0.12)] font-semibold text-white transition hover:bg-[rgb(255_255_255/0.2)] disabled:opacity-60 ${tamanho}`}
              >
                <Pause className="size-5" aria-hidden />
                {pausando ? "Salvando…" : "Pausar"}
              </button>
            </form>
            <form action={pausar}>
              <input type="hidden" name="chamado_id" value={chamadoId} />
              <input type="hidden" name="finalizar" value="1" />
              <button
                type="submit"
                disabled={ocupado}
                className={`flex w-full items-center justify-center gap-2 rounded-full bg-marca font-semibold text-[#06140a] transition hover:brightness-105 disabled:opacity-60 ${tamanho}`}
              >
                <Flag className="size-5" aria-hidden />
                Finalizar
              </button>
            </form>
          </div>
        </div>
      ) : (
        <form action={iniciar} className="flex flex-col gap-2">
          <input type="hidden" name="chamado_id" value={chamadoId} />
          <button
            type="submit"
            disabled={ocupado || bloqueio !== null}
            className={`flex w-full items-center justify-center gap-2 rounded-full bg-marca font-semibold text-[#06140a] shadow-[0_8px_24px_-8px_rgb(88_192_105/0.7)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none ${tamanho}`}
          >
            <Play className="size-5" aria-hidden />
            {iniciando ? "Iniciando…" : "Iniciar"}
          </button>
          <p className="text-center text-xs text-neutral-500">
            {bloqueio ??
              "Toque ao chegar no local. Pause na saída e finalize ao terminar."}
          </p>
        </form>
      )}

      {outrosRodando > 0 && (
        <p className="flex items-center gap-2 text-xs text-neutral-600">
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
              <input type="hidden" name="chamado_id" value={chamadoId} />
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
