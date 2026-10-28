"use client";

import { CircleCheck, CircleX, Play } from "lucide-react";
import { useActionState } from "react";
import { useNotificarEstado } from "@/components/notificacoes";
import { formatarDataHora } from "@/lib/formato";

// "Rodar rotinas agora": o que o cron faz de hora em hora, com o resultado
// de cada rotina na tela (para testar sem esperar a próxima hora).

export interface ResultadoNaTela {
  chave: string;
  rotulo: string;
  ok: boolean;
  registros: number;
  erro?: string;
  ms: number;
}

export interface EstadoNaTela {
  resultados?: ResultadoNaTela[];
  em?: string;
  erro?: string;
}

export function RodarRotinas({
  acao,
}: {
  acao: (anterior: EstadoNaTela, form: FormData) => Promise<EstadoNaTela>;
}) {
  const [estado, rodar, rodando] = useActionState(acao, {});
  useNotificarEstado(estado);
  return (
    <form action={rodar} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={rodando}
          className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-60"
        >
          <Play className="size-4" aria-hidden />
          {rodando ? "Rodando…" : "Rodar rotinas agora"}
        </button>
        {estado.em && !rodando && (
          <span className="text-xs text-neutral-500">
            Rodou em {formatarDataHora(estado.em)}
          </span>
        )}
      </div>
      {estado.resultados && (
        <ul
          aria-live="polite"
          className="flex flex-col divide-y divide-neutral-900/[0.06]"
        >
          {estado.resultados.map((r) => (
            <li key={r.chave} className="flex items-start gap-3 py-2.5 text-sm">
              {r.ok ? (
                <CircleCheck
                  className="mt-0.5 size-4 shrink-0 text-green-700"
                  aria-label="Rodou"
                />
              ) : (
                <CircleX
                  className="mt-0.5 size-4 shrink-0 text-red-700"
                  aria-label="Falhou"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium">{r.rotulo}</p>
                <p
                  className={`text-xs ${r.ok ? "text-neutral-500" : "text-red-700"}`}
                >
                  {r.ok
                    ? r.registros === 0
                      ? "Nada a fazer agora."
                      : `${r.registros} ${r.registros === 1 ? "registro criado ou mudado" : "registros criados ou mudados"}.`
                    : `Falhou: ${r.erro}`}
                </p>
              </div>
              <span className="shrink-0 text-xs text-neutral-400 tabular-nums">
                {(r.ms / 1000).toLocaleString("pt-BR", {
                  maximumFractionDigits: 1,
                })}{" "}
                s
              </span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
