"use client";

import {
  ClipboardCheck,
  ClipboardList,
  FilePlus2,
  Handshake,
  Smile,
  Ticket,
  X,
} from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import type { EstadoAcao } from "@/components/form-acao";
import { notificar } from "@/components/notificacoes";
import { MODELOS, type NomeDoModelo } from "@/lib/formularios/modelos";
import { criarFormulario } from "@/server/formularios/acoes/formularios";

// "Novo relatório": abre os modelos (como Google Forms, Tally e Jotform).
// Escolher um cria o rascunho e abre o editor; tudo é editável depois.

const ICONE: Record<NomeDoModelo, typeof FilePlus2> = {
  branco: FilePlus2,
  visita: ClipboardList,
  vistoria: ClipboardCheck,
  satisfacao: Smile,
  inscricao: Ticket,
  fornecedor: Handshake,
};

export function NovoRelatorio() {
  const [aberto, setAberto] = useState(false);
  const [estado, executar, enviando] = useActionState<EstadoAcao, FormData>(
    criarFormulario,
    {},
  );
  const [escolhido, setEscolhido] = useState<string | null>(null);
  useEffect(() => {
    if (estado.erro) notificar("erro", estado.erro);
  }, [estado]);

  if (!aberto)
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="w-fit rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
      >
        + Novo relatório
      </button>
    );

  return (
    <section
      aria-label="Escolha um modelo"
      className="vidro flex flex-col gap-4 rounded-[1.75rem] p-5 md:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Novo relatório</h2>
          <p className="text-sm text-neutral-500">
            Comece em branco ou de um modelo. Dá para mudar tudo depois.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAberto(false)}
          aria-label="Fechar"
          className="grid size-8 place-items-center rounded-full text-neutral-500 transition hover:bg-neutral-900/5 hover:text-neutral-900"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <form
        action={(f) => {
          setEscolhido(String(f.get("modelo")));
          executar(f);
        }}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        {(Object.keys(MODELOS) as NomeDoModelo[]).map((nome) => {
          const m = MODELOS[nome];
          const Icone = ICONE[nome];
          return (
            <button
              key={nome}
              type="submit"
              name="modelo"
              value={nome}
              disabled={enviando}
              className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-left transition hover:border-neutral-900 disabled:cursor-wait disabled:opacity-60"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-neutral-900/[0.06]">
                <Icone className="size-4" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium">
                  {enviando && escolhido === nome ? "Criando…" : m.rotulo}
                </span>
                <span className="text-xs text-neutral-500">{m.resumo}</span>
              </span>
            </button>
          );
        })}
      </form>
    </section>
  );
}
