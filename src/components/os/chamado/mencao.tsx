"use client";

import { useId, useRef, useState } from "react";
import { classeCampo } from "@/components/estilos";
import { iniciais } from "@/lib/formato";
import { filtrarPessoas, mencaoEmDigitacao } from "@/lib/os/chamado";

// Texto com @menção: ao digitar "@" aparece a lista de pessoas do módulo
// (setas, Enter ou Tab escolhem; Esc fecha). O nome entra inteiro no texto
// e o servidor descobre quem foi citado pelo nome.

export interface PessoaMencao {
  id: string;
  nome: string;
}

export function CampoComMencao({
  pessoas,
  name,
  valor,
  aoMudar,
  placeholder,
  linhas = 3,
  rotulo,
  id,
  className = "",
  aoEnviarAtalho,
}: {
  pessoas: PessoaMencao[];
  name: string;
  valor: string;
  aoMudar: (texto: string) => void;
  placeholder?: string;
  linhas?: number;
  /** Nome acessível, quando não há <label htmlFor>. */
  rotulo?: string;
  id?: string;
  className?: string;
  /** Ctrl+Enter envia (comentário). */
  aoEnviarAtalho?: () => void;
}) {
  const campo = useRef<HTMLTextAreaElement>(null);
  const [mencao, setMencao] = useState<{
    inicio: number;
    termo: string;
  } | null>(null);
  const [ativo, setAtivo] = useState(0);
  const idLista = useId();
  const sugestoes = mencao ? filtrarPessoas(pessoas, mencao.termo) : [];
  const aberta = sugestoes.length > 0;

  function atualizar(texto: string, cursor: number) {
    aoMudar(texto);
    setMencao(mencaoEmDigitacao(texto, cursor));
    setAtivo(0);
  }

  function escolher(p: PessoaMencao) {
    const el = campo.current;
    if (!el || !mencao) return;
    const fim = mencao.inicio + 1 + mencao.termo.length;
    const texto = `${valor.slice(0, mencao.inicio)}@${p.nome} ${valor.slice(fim)}`;
    const cursor = mencao.inicio + p.nome.length + 2;
    aoMudar(texto);
    setMencao(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }

  function tecla(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && aoEnviarAtalho) {
      e.preventDefault();
      aoEnviarAtalho();
      return;
    }
    if (!aberta) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const passo = e.key === "ArrowDown" ? 1 : -1;
      setAtivo((a) => (a + passo + sugestoes.length) % sugestoes.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      const p = sugestoes[ativo];
      if (p) {
        e.preventDefault();
        escolher(p);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setMencao(null);
    }
  }

  return (
    <div className={`relative ${className}`}>
      <textarea
        ref={campo}
        id={id}
        name={name}
        rows={linhas}
        value={valor}
        placeholder={placeholder}
        aria-label={rotulo}
        aria-autocomplete="list"
        aria-controls={aberta ? idLista : undefined}
        aria-expanded={aberta}
        aria-activedescendant={aberta ? `${idLista}-${ativo}` : undefined}
        role="combobox"
        onChange={(e) =>
          atualizar(e.target.value, e.target.selectionStart ?? 0)
        }
        onKeyDown={tecla}
        onBlur={() => setTimeout(() => setMencao(null), 150)}
        className={`${classeCampo} resize-y`}
      />
      {aberta && (
        <div
          id={idLista}
          role="listbox"
          aria-label="Citar alguém"
          className="painel-modal absolute inset-x-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-2xl p-1.5 text-sm"
        >
          {sugestoes.map((p, k) => (
            <button
              key={p.id}
              id={`${idLista}-${k}`}
              type="button"
              role="option"
              aria-selected={k === ativo}
              tabIndex={-1}
              onMouseDown={(e) => {
                e.preventDefault();
                escolher(p);
              }}
              onMouseEnter={() => setAtivo(k)}
              className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left ${k === ativo ? "bg-neutral-900/[0.07]" : ""}`}
            >
              <span
                aria-hidden
                className="grid size-7 shrink-0 place-items-center rounded-full bg-violet-100 text-[10px] font-semibold text-violet-700"
              >
                {iniciais(p.nome)}
              </span>
              <span className="truncate">{p.nome}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
