"use client";

import { EllipsisVertical, Eye, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Acao } from "@/components/form-acao";
import {
  ModalConfirmacao,
  useConfirmacao,
} from "@/components/modal-confirmacao";

const ITEM =
  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition";

/**
 * Ações de uma folha importada num menu de três pontinhos. O menu abre no
 * <body>, preso ao botão: a tabela rola na horizontal e cortaria o menu.
 */
export function MenuFolha({
  folhaId,
  ver,
  excluir,
  confirmar,
}: {
  folhaId: string;
  /** Sem permissão individual não há o link. */
  ver?: { href: string; rotulo: string };
  /** Folha fechada não tem Excluir. */
  excluir?: Acao;
  confirmar: string;
}) {
  const [posicao, setPosicao] = useState<React.CSSProperties | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [estado, executar, enviando] = useActionState(
    excluir ?? (async () => ({})),
    {},
  );
  const confirmacao = useConfirmacao({ confirmar, estado });
  const aberto = posicao !== null;

  useEffect(() => {
    if (!aberto) return;
    menu.current?.querySelector<HTMLElement>("a, button")?.focus();
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node;
      if (!menu.current?.contains(alvo) && !botao.current?.contains(alvo))
        setPosicao(null);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setPosicao(null);
      botao.current?.focus();
    };
    const fechar = () => setPosicao(null);
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("resize", fechar);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("resize", fechar);
    };
  }, [aberto]);

  if (!ver && !excluir) return null;

  function alternar() {
    const r = botao.current?.getBoundingClientRect();
    if (aberto || !r) return setPosicao(null);
    const direita = window.innerWidth - r.right;
    // Perto do fim da tela, abre para cima.
    setPosicao(
      r.bottom + 120 > window.innerHeight
        ? { bottom: window.innerHeight - r.top + 4, right: direita }
        : { top: r.bottom + 4, right: direita },
    );
  }

  return (
    <div className="flex justify-end">
      <button
        ref={botao}
        type="button"
        onClick={alternar}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label="Ações da folha"
        disabled={enviando}
        className="grid size-9 place-items-center rounded-full text-neutral-600 transition hover:bg-neutral-900/[0.06] hover:text-neutral-900 disabled:cursor-wait disabled:opacity-60"
      >
        <EllipsisVertical className="size-4" aria-hidden />
      </button>

      {aberto &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            style={posicao}
            className="fixed z-50 min-w-44 rounded-2xl bg-white p-1.5 shadow-lg ring-1 ring-neutral-900/[0.08]"
          >
            {ver && (
              <Link
                role="menuitem"
                href={ver.href}
                onClick={() => setPosicao(null)}
                className={`${ITEM} text-neutral-800 hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:outline-none`}
              >
                <Eye className="size-4" aria-hidden />
                {ver.rotulo}
              </Link>
            )}
            {excluir && (
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  setPosicao(null);
                  // O envio para no modal de confirmação.
                  confirmacao.form.current?.requestSubmit();
                }}
                className={`${ITEM} text-red-700 hover:bg-red-50 focus-visible:bg-red-50 focus-visible:outline-none`}
              >
                <Trash2 className="size-4" aria-hidden />
                Excluir
              </button>
            )}
          </div>,
          document.body,
        )}

      {excluir && (
        <form
          ref={confirmacao.form}
          action={executar}
          onSubmit={confirmacao.onSubmit}
          hidden
        >
          <input type="hidden" name="folha_id" value={folhaId} />
          <ModalConfirmacao
            {...confirmacao.modal}
            rotulo="Excluir"
            rotuloEnviando="Excluindo…"
            perigo
            enviando={enviando}
          />
        </form>
      )}
    </div>
  );
}
