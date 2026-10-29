"use client";

import {
  Building2,
  CircleCheck,
  CircleDashed,
  CirclePause,
  CirclePlay,
  Eye,
  Pencil,
  UserRound,
} from "lucide-react";
import { useActionState, useState } from "react";
import { formatarDataHora } from "@/lib/formato";
import type { StatusDestino } from "@/lib/os/ciclo";
import { andarDestino, definirTarefaDestino } from "@/server/os/acoes/chamados";

// Andamento de cada destinatário (Aviso para vários setores, pessoas
// extras): cada um confirma que leu e conclui a própria parte; o chamado
// conclui sozinho quando todos concluírem (gatilho no banco).

export interface LinhaDestino {
  id: string;
  nome: string;
  pessoa: boolean;
  titulo: string | null;
  status: StatusDestino;
  prazo: string | null;
  lidoEm: string | null;
  concluidoEm: string | null;
  concluidoPor: string | null;
  meu: boolean;
  /** Em ordem: o anterior que ainda não concluiu (null: é a vez). */
  espera: string | null;
}

const SITUACAO: Record<
  StatusDestino,
  { rotulo: string; Icone: typeof CircleCheck; classe: string }
> = {
  aberto: {
    rotulo: "Aberto",
    Icone: CircleDashed,
    classe: "bg-neutral-900/[0.06] text-neutral-700",
  },
  em_andamento: {
    rotulo: "Em andamento",
    Icone: CirclePlay,
    classe: "bg-violet-400/20 text-violet-700",
  },
  aguardando: {
    rotulo: "Aguardando",
    Icone: CirclePause,
    classe: "bg-amber-50 text-amber-900",
  },
  concluido: {
    rotulo: "Concluído",
    Icone: CircleCheck,
    classe: "bg-green-50 text-green-700",
  },
};

const BOTAO =
  "inline-flex min-h-10 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400 disabled:opacity-60";

export function Destinos({
  linhas,
  emOrdem = false,
  andamento,
  nomes,
  encerrado,
  definirTarefas = false,
}: {
  linhas: LinhaDestino[];
  /** Um depois do outro: cada um espera o anterior concluir. */
  emOrdem?: boolean;
  andamento: { texto: string; concluidos: number; total: number };
  nomes: Record<string, string>;
  /** Fechado ou cancelado: só leitura. */
  encerrado: boolean;
  /** Quem coordena (pediu, responde, é do setor, gerencia) define as tarefas. */
  definirTarefas?: boolean;
}) {
  const [estado, executar, enviando] = useActionState(andarDestino, {});
  const faltam = linhas.filter((l) => l.status !== "concluido");

  const botao = (
    l: LinhaDestino,
    acao: string,
    rotulo: string,
    Icone: typeof Eye,
  ) => (
    <form action={executar}>
      <input type="hidden" name="id" value={l.id} />
      <input type="hidden" name="acao" value={acao} />
      <button type="submit" disabled={enviando} className={BOTAO}>
        <Icone className="size-4" aria-hidden />
        {rotulo}
      </button>
    </form>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div
            role="progressbar"
            aria-label="Destinos concluídos"
            aria-valuemin={0}
            aria-valuemax={andamento.total}
            aria-valuenow={andamento.concluidos}
            className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-900/[0.07]"
          >
            <div
              className="h-full rounded-full bg-marca"
              style={{
                width: `${(andamento.concluidos / Math.max(1, andamento.total)) * 100}%`,
              }}
            />
          </div>
          <span className="text-xs font-medium text-neutral-700">
            {andamento.texto}
          </span>
        </div>
        {faltam.length > 0 && (
          <p className="text-xs text-neutral-600">
            Falta: {faltam.map((l) => l.nome).join(", ")}
          </p>
        )}
      </div>
      <ul className="flex flex-col gap-2">
        {linhas.map((l, i) => {
          const s = SITUACAO[l.status];
          return (
            <li
              key={l.id}
              className="flex flex-col gap-3 rounded-2xl border border-neutral-900/[0.06] bg-white/60 p-3 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-neutral-900/[0.05] text-sm font-semibold text-neutral-600">
                  {emOrdem ? (
                    i + 1
                  ) : l.pessoa ? (
                    <UserRound className="size-4" aria-hidden />
                  ) : (
                    <Building2 className="size-4" aria-hidden />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {l.nome}
                  </span>
                  <Tarefa
                    id={l.id}
                    nome={l.nome}
                    titulo={l.titulo}
                    editavel={definirTarefas && !encerrado}
                  />
                  <span className="block text-xs text-neutral-500">
                    {l.concluidoEm
                      ? `Concluído ${l.concluidoPor ? `por ${nomes[l.concluidoPor] ?? "alguém"} ` : ""}em ${formatarDataHora(l.concluidoEm)}`
                      : l.espera
                        ? `Espera ${l.espera} concluir`
                        : l.lidoEm
                          ? `Leu em ${formatarDataHora(l.lidoEm)}`
                          : "Ainda não leu"}
                    {l.prazo && !l.concluidoEm
                      ? ` · prazo ${formatarDataHora(l.prazo)}`
                      : ""}
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.classe}`}
                >
                  <s.Icone className="size-3.5" aria-hidden />
                  {s.rotulo}
                </span>
                {l.meu && !encerrado && (
                  <>
                    {!l.lidoEm &&
                      l.status === "aberto" &&
                      botao(l, "ler", "Li", Eye)}
                    {l.status === "aberto" &&
                      !l.espera &&
                      botao(l, "iniciar", "Começar", CirclePlay)}
                    {l.status !== "concluido" &&
                      !l.espera &&
                      botao(
                        l,
                        "concluir",
                        "Concluir a minha parte",
                        CircleCheck,
                      )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {estado.erro && (
        <p role="alert" className="text-sm text-red-700">
          {estado.erro}
        </p>
      )}
    </div>
  );
}

/** O que cabe a este destino ("Enviar logo"), com edição no lugar. */
function Tarefa({
  id,
  nome,
  titulo,
  editavel,
}: {
  id: string;
  nome: string;
  titulo: string | null;
  editavel: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [estado, executar, enviando] = useActionState(
    async (anterior: { erro?: string }, form: FormData) => {
      const r = await definirTarefaDestino(anterior, form);
      if (!r.erro) setEditando(false);
      return r;
    },
    {},
  );

  if (editando)
    return (
      <form action={executar} className="mt-1 flex flex-col gap-1.5">
        <input type="hidden" name="id" value={id} />
        <div className="flex flex-wrap items-center gap-2">
          <input
            name="tarefa"
            defaultValue={titulo ?? ""}
            maxLength={200}
            // biome-ignore lint/a11y/noAutofocus: abriu agora para escrever
            autoFocus
            placeholder="O que fazer (ex.: enviar a logo)"
            aria-label={`O que cabe a ${nome}`}
            onKeyDown={(e) => e.key === "Escape" && setEditando(false)}
            className="min-h-9 min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white px-3 text-sm focus:border-neutral-400 focus:outline-none"
          />
          <button type="submit" disabled={enviando} className={BOTAO}>
            Salvar
          </button>
          <button
            type="button"
            onClick={() => setEditando(false)}
            className="min-h-10 px-2 text-sm text-neutral-600 hover:text-neutral-900"
          >
            Cancelar
          </button>
        </div>
        {estado.erro && (
          <p role="alert" className="text-xs text-red-700">
            {estado.erro}
          </p>
        )}
      </form>
    );

  if (!titulo && !editavel) return null;
  return (
    <span className="flex items-center gap-1">
      {titulo ? (
        <span className="text-sm break-words text-neutral-800">{titulo}</span>
      ) : null}
      {editavel && (
        <button
          type="button"
          onClick={() => setEditando(true)}
          aria-label={titulo ? `Trocar a tarefa de ${nome}` : undefined}
          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs text-neutral-500 transition hover:bg-neutral-900/[0.06] hover:text-neutral-800"
        >
          <Pencil className="size-3" aria-hidden />
          {!titulo && "Definir tarefa"}
        </button>
      )}
    </span>
  );
}
