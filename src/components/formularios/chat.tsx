"use client";

import { MessageCircleQuestion, SendHorizontal } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { classeCampo } from "@/components/estilos";
import type { Campo } from "@/lib/formularios/campos";
import {
  perguntar,
  type Registro,
  type RespostaDoChat,
  sugestoes,
} from "@/lib/formularios/perguntar";

// "Pergunte às respostas" (reunião de 05/11): em vez de uma tela fixa de
// indicadores por relatório, a pessoa pergunta ("quantas pessoas
// responderam?") e o chat responde com as respostas carregadas na tela.
// Nada sai do sistema: a conta é feita aqui, em src/lib/formularios/perguntar.

interface Mensagem {
  pergunta: string;
  resposta: RespostaDoChat;
}

export function ChatDasRespostas({
  campos,
  registros,
}: {
  campos: Campo[];
  registros: Registro[];
}) {
  const [conversa, setConversa] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const id = useId();
  const fim = useRef<HTMLDivElement>(null);
  const exemplos = sugestoes(campos);

  // biome-ignore lint/correctness/useExhaustiveDependencies: rola a cada mensagem nova
  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [conversa.length]);

  function enviar(pergunta: string) {
    const p = pergunta.trim();
    if (!p) return;
    setConversa((c) => [
      ...c,
      { pergunta: p, resposta: perguntar(p, campos, registros) },
    ]);
    setTexto("");
  }

  return (
    <section
      data-guia="formularios-chat"
      aria-label="Pergunte às respostas"
      className="vidro flex flex-col gap-4 rounded-[1.75rem] p-5 md:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-neutral-900 text-white">
          <MessageCircleQuestion className="size-4" aria-hidden />
        </span>
        <div>
          <h2 className="text-base font-semibold">Pergunte às respostas</h2>
          <p className="text-sm text-neutral-500">
            Pergunte em português: quantidade, uma opção, média, a mais
            escolhida, um período (hoje, nesta semana, em outubro).
          </p>
        </div>
      </div>

      {conversa.length > 0 && (
        <div
          role="log"
          aria-live="polite"
          className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto pr-1"
        >
          {conversa.map((m, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a conversa só cresce
            <div key={i} className="flex flex-col gap-2">
              <p className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-neutral-900 px-3.5 py-2 text-sm text-white">
                {m.pergunta}
              </p>
              <div
                data-resposta-do-chat
                className="flex max-w-[92%] flex-col gap-2 self-start rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-sm text-neutral-800"
              >
                <p>{m.resposta.texto}</p>
                {m.resposta.linhas && m.resposta.linhas.length > 0 && (
                  <ul className="flex list-disc flex-col gap-0.5 pl-5 text-neutral-600">
                    {m.resposta.linhas.map((l, j) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: linhas podem repetir
                      <li key={j} className="break-words">
                        {l}
                      </li>
                    ))}
                  </ul>
                )}
                {m.resposta.sugestoes && (
                  <Sugestoes lista={m.resposta.sugestoes} escolher={enviar} />
                )}
              </div>
            </div>
          ))}
          <div ref={fim} />
        </div>
      )}

      {conversa.length === 0 && (
        <Sugestoes lista={exemplos} escolher={enviar} />
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(texto);
        }}
        className="flex items-center gap-2"
      >
        <label htmlFor={id} className="sr-only">
          Sua pergunta
        </label>
        <input
          id={id}
          value={texto}
          maxLength={300}
          autoComplete="off"
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ex.: quantas pessoas responderam?"
          className={`${classeCampo} min-w-0 flex-1`}
        />
        <button
          type="submit"
          disabled={!texto.trim()}
          aria-label="Perguntar"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-neutral-900 text-white transition hover:bg-neutral-800 disabled:opacity-40"
        >
          <SendHorizontal className="size-4" aria-hidden />
        </button>
      </form>
    </section>
  );
}

function Sugestoes({
  lista,
  escolher,
}: {
  lista: string[];
  escolher: (s: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {lista.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => escolher(s)}
          className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-left text-xs text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-900"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
