"use client";

import { CalendarClock, Printer, X } from "lucide-react";
import { useState } from "react";
import {
  atribuirResponsavel,
  mudarPrioridade,
} from "@/app/(app)/os/visoes-actions";
import { Selecao } from "@/components/selecao";
import type { LinhaChamado } from "@/lib/os/lista";
import { PRIORIDADES } from "@/lib/os/rotulos";
import { JanelaPrazo, type PessoaOpcao, useAcaoRapida } from "./edicao";

// Ações em lote sobre os chamados marcados (como nos service desks):
// atribuir responsável, mudar prazo, mudar prioridade e imprimir as OS.
// Cada chamado passa pelas regras sozinho; o retorno diz quantos mudaram.

/** PDF das OS marcadas, montado pela tela de Ordens de Serviço. */
export const rotaImprimirOs = (ids: string[]) =>
  `/os/ordens/pdf?ids=${ids.join(",")}`;

export function BarraDoLote({
  selecionadas,
  pessoasPorSetor,
  aoLimpar,
}: {
  selecionadas: LinhaChamado[];
  pessoasPorSetor: Record<string, PessoaOpcao[]>;
  aoLimpar: () => void;
}) {
  const { pendente, executar } = useAcaoRapida();
  const [prazoAberto, setPrazoAberto] = useState(false);
  const ids = selecionadas.map((l) => l.id);
  const atribuiveis = selecionadas.filter((l) => l.podeAtribuir);
  const comPrazo = selecionadas.filter((l) => l.podePrazo);
  const ordens = selecionadas.filter((l) => l.tipo === "os");

  // Pessoas dos setores dos chamados marcados, sem repetir.
  const pessoas = [
    ...new Map(
      atribuiveis
        .flatMap((l) => pessoasPorSetor[l.setorId] ?? [])
        .map((p) => [p.id, p]),
    ).values(),
  ].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const depois = (r: { erro?: string }) => {
    if (!r.erro) aoLimpar();
  };

  return (
    <section
      aria-label="Ações nos chamados marcados"
      className="painel-modal sticky bottom-4 z-20 flex flex-wrap items-center gap-1.5 rounded-[1.75rem] p-2 pl-4 text-neutral-900 sm:rounded-full"
    >
      <p className="mr-1 text-sm font-medium">
        {selecionadas.length}{" "}
        {selecionadas.length === 1 ? "marcado" : "marcados"}
      </p>
      {atribuiveis.length > 0 && (
        <Selecao
          variante="embutida"
          rotulo="Atribuir responsável aos marcados"
          placeholder="Atribuir a…"
          className="w-44"
          desabilitada={pendente}
          valor=""
          aoMudar={(v) =>
            executar(
              () =>
                atribuirResponsavel(
                  atribuiveis.map((l) => l.id),
                  v === "fila" ? null : v,
                ),
              depois,
            )
          }
          opcoes={[
            { valor: "fila", rotulo: "Na fila (sem responsável)" },
            ...pessoas.map((p) => ({ valor: p.id, rotulo: p.nome })),
          ]}
        />
      )}
      {comPrazo.length > 0 && (
        <button
          type="button"
          disabled={pendente}
          onClick={() => setPrazoAberto(true)}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm transition hover:bg-neutral-900/[0.06] disabled:opacity-60"
        >
          <CalendarClock className="size-4" aria-hidden />
          Prazo
        </button>
      )}
      {comPrazo.length > 0 && (
        <Selecao
          variante="embutida"
          rotulo="Mudar a prioridade dos marcados"
          placeholder="Prioridade…"
          className="w-36"
          desabilitada={pendente}
          valor=""
          aoMudar={(v) =>
            executar(
              () =>
                mudarPrioridade(
                  comPrazo.map((l) => l.id),
                  v,
                ),
              depois,
            )
          }
          opcoes={Object.entries(PRIORIDADES).map(([valor, rotulo]) => ({
            valor,
            rotulo,
          }))}
        />
      )}
      {ordens.length > 0 && (
        <a
          href={rotaImprimirOs(ordens.map((l) => l.id))}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm transition hover:bg-neutral-900/[0.06]"
        >
          <Printer className="size-4" aria-hidden />
          Imprimir {ordens.length === 1 ? "OS" : `${ordens.length} OS`}
        </a>
      )}
      <button
        type="button"
        onClick={aoLimpar}
        aria-label="Desmarcar todos"
        className="ml-auto grid size-9 place-items-center rounded-full transition hover:bg-neutral-900/[0.06]"
      >
        <X className="size-4" aria-hidden />
      </button>
      <JanelaPrazo
        aberta={prazoAberto}
        ids={comPrazo.map((l) => l.id)}
        atual={null}
        titulo={`Novo prazo para ${comPrazo.length} ${comPrazo.length === 1 ? "chamado" : "chamados"}`}
        aoFechar={() => setPrazoAberto(false)}
        aoConcluir={aoLimpar}
      />
      {ids.length > comPrazo.length && comPrazo.length > 0 && (
        <p className="w-full px-1 text-xs text-neutral-500">
          Prazo e prioridade mudam só nos {comPrazo.length} que você pode
          alterar.
        </p>
      )}
    </section>
  );
}
