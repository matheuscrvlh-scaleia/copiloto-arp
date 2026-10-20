"use client";

import { Bell, ChevronRight } from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { Aviso } from "@/server/avisos";

const LARGURA = 352; // 22rem
const MARGEM = 16;

/**
 * Sino com o painel de notificações, que abre acima do rodapé do menu.
 * O painel é desenhado no <body>: dentro do menu de vidro (backdrop-filter)
 * ele ficaria preso ao menu e por baixo do conteúdo da página.
 */
export function Notificacoes({ avisos }: { avisos: Aviso[] }) {
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState<{
    left: number;
    bottom: number;
    width: number;
  } | null>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const painel = useRef<HTMLElement>(null);
  const painelId = useId();

  const posicionar = useCallback(() => {
    const r = raiz.current?.getBoundingClientRect();
    if (!r) return;
    const vw = window.innerWidth;
    const width = Math.min(LARGURA, vw - 2 * MARGEM);
    // No desktop abre puxado para a esquerda (sobre o menu); no celular,
    // alinhado à direita do sino.
    const desejado = vw >= 768 ? r.left - 176 : r.right - width;
    setPos({
      left: Math.max(MARGEM, Math.min(desejado, vw - width - MARGEM)),
      bottom: window.innerHeight - r.top + 12,
      width,
    });
  }, []);

  useLayoutEffect(() => {
    if (aberto) posicionar();
    else setPos(null);
  }, [aberto, posicionar]);

  // Fecha com Esc ou clique fora; acompanha a tela ao rolar ou redimensionar.
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (!raiz.current?.contains(alvo) && !painel.current?.contains(alvo))
        setAberto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    window.addEventListener("resize", posicionar);
    window.addEventListener("scroll", posicionar, true);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("resize", posicionar);
      window.removeEventListener("scroll", posicionar, true);
    };
  }, [aberto, posicionar]);

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-controls={painelId}
        aria-label={
          avisos.length ? `Notificações (${avisos.length})` : "Notificações"
        }
        className="relative grid size-10 place-items-center rounded-xl bg-white text-neutral-600 shadow-sm ring-1 ring-black/5 transition hover:text-neutral-900"
      >
        <Bell className="size-4" aria-hidden />
        {avisos.length > 0 && (
          <span className="absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full bg-marca px-1 text-[10px] font-semibold text-[#fff]">
            {avisos.length}
          </span>
        )}
      </button>

      {aberto &&
        pos &&
        createPortal(
          <section
            ref={painel}
            id={painelId}
            aria-label="Notificações"
            style={{ left: pos.left, bottom: pos.bottom, width: pos.width }}
            className="fixed z-[100] overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-black/5"
          >
            <h2 className="border-b border-neutral-200 px-5 py-4 text-sm font-semibold tracking-wider text-neutral-600 uppercase">
              Notificações
            </h2>
            {avisos.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-5 py-10 text-sm text-neutral-500">
                <span className="grid size-12 place-items-center rounded-2xl bg-neutral-100 text-neutral-500">
                  <Bell className="size-5" aria-hidden />
                </span>
                Nenhuma notificação
              </div>
            ) : (
              <ul className="max-h-80 divide-y divide-neutral-100 overflow-y-auto">
                {avisos.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={a.href}
                      onClick={() => setAberto(false)}
                      className="flex items-center gap-3 px-5 py-3 transition hover:bg-neutral-50"
                    >
                      <span
                        className="size-2 shrink-0 rounded-full bg-marca"
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-neutral-900">
                          {a.titulo}
                        </span>
                        <span className="block text-xs text-neutral-500">
                          {a.descricao}
                        </span>
                      </span>
                      <ChevronRight
                        className="size-4 shrink-0 text-neutral-400"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>,
          document.body,
        )}
    </div>
  );
}
