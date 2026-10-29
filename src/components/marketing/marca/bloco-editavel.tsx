"use client";

import { Pencil, X } from "lucide-react";
import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { classeCampo } from "@/components/estilos";
import { useNotificarEstado } from "@/components/notificacoes";
import type { ItemLista, TipoBloco } from "@/lib/marketing/marca";
import { salvarBloco } from "@/server/marketing/acoes/marca";
import { EditorItens } from "./editor-itens";

// Cartão de um bloco da marca. Quem tem marketing.marca.editar vê o botão
// "Editar", que troca o conteúdo pelo formulário ali mesmo; o conteúdo
// desenhado vem pronto do servidor (children).

const DICA: Record<TipoBloco, string> = {
  texto: "Texto corrido. Linha em branco separa os parágrafos.",
  lista:
    "Um item por linha. Para explicar o item, use travessão: Humorada — Leve, sem piada pronta.",
  cores:
    "Uma cor por linha: Nome — #RRGGBB — onde usar. Ex.: Verde Arp — #58C069 — fundos e destaques.",
};

const DICA_PALAVRAS =
  "Uma palavra ou expressão por linha. O revisor de texto lê esta lista.";

export function BlocoEditavel({
  chave,
  titulo,
  descricao,
  tipo,
  versao,
  texto,
  podeEditar,
  palavras = false,
  itens,
  className = "",
  classeTom = "vidro",
  children,
}: {
  chave: string;
  titulo: string;
  descricao: string | null;
  tipo: TipoBloco;
  versao: number;
  /** Conteúdo atual no formato do formulário. */
  texto: string;
  podeEditar: boolean;
  /** Lista de palavras do revisor (dica própria). */
  palavras?: boolean;
  /** Lista editada item a item (nome e significado) em vez do texto. */
  itens?: ItemLista[];
  className?: string;
  classeTom?: string;
  children: React.ReactNode;
}) {
  const [editando, setEditando] = useState(false);
  const [estado, executar, salvando] = useActionState(salvarBloco, {});
  useNotificarEstado(estado);
  const anterior = useRef(estado);
  const campo = useId();
  // Salvou (ou nada mudou): fecha o formulário. Erro: continua aberto.
  useEffect(() => {
    if (estado === anterior.current) return;
    anterior.current = estado;
    if (estado.ok) setEditando(false);
  }, [estado]);

  const linhas = Math.min(18, Math.max(4, texto.split("\n").length + 2));

  return (
    <section
      id={`bloco-${chave}`}
      className={`${classeTom} scroll-mt-6 rounded-[1.75rem] p-5 md:p-6 ${className}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{titulo}</h2>
          {descricao && (
            <p className="mt-1 text-xs text-neutral-500">{descricao}</p>
          )}
        </div>
        {podeEditar && !editando && (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 bg-white/70 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-900"
          >
            <Pencil className="size-3.5" aria-hidden />
            Editar
          </button>
        )}
      </header>

      {editando ? (
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const dados = new FormData(e.currentTarget);
            startTransition(() => executar(dados));
          }}
        >
          <input type="hidden" name="chave" value={chave} />
          <input type="hidden" name="versao" value={versao} />
          {itens ? (
            <EditorItens chave={chave} itens={itens} />
          ) : (
            <>
              <label htmlFor={campo} className="text-xs text-neutral-500">
                {palavras ? DICA_PALAVRAS : DICA[tipo]}
              </label>
              <textarea
                id={campo}
                name="texto"
                defaultValue={texto}
                rows={linhas}
                // biome-ignore lint/a11y/noAutofocus: abriu por clique em "Editar"
                autoFocus
                className={`${classeCampo} min-h-24 font-[inherit] leading-relaxed`}
              />
            </>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={salvando}
              className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-60"
            >
              {salvando ? "Salvando…" : "Salvar"}
            </button>
            <button
              type="button"
              onClick={() => setEditando(false)}
              disabled={salvando}
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400 disabled:opacity-60"
            >
              <X className="size-3.5" aria-hidden />
              Cancelar
            </button>
            <span className="text-xs text-neutral-500">
              A versão atual fica no histórico.
            </span>
          </div>
        </form>
      ) : (
        <div className="mt-4">{children}</div>
      )}
    </section>
  );
}
