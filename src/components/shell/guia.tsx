"use client";

import "driver.js/dist/driver.css";
import type { Config, Driver, DriveStep } from "driver.js";
import { Compass, Route, SquareMousePointer } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { chaveVisto, guiaDa, TRILHAS, trilhasDa } from "@/config/guias";
import {
  alvoNaTela,
  criarTrilha,
  rotaDoPasso,
  trilhaEmAndamento,
} from "./trilha";

function marcarVisto(chave: string, versao: number) {
  try {
    localStorage.setItem(chaveVisto(chave), String(versao));
  } catch {
    // Sem armazenamento: o ponto de novidade volta ao recarregar.
  }
}

function jaViu(chave: string, versao: number) {
  try {
    return localStorage.getItem(chaveVisto(chave)) === String(versao);
  } catch {
    return true;
  }
}

/** Aparência e textos comuns ao guia da tela e às trilhas. */
function configBase(): Config {
  const parado = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return {
    nextBtnText: "Próximo",
    prevBtnText: "Voltar",
    doneBtnText: "Concluir",
    closeBtnLabel: "Fechar o guia",
    popoverClass: "guia-popover",
    popoverOffset: 12,
    stagePadding: 6,
    stageRadius: 22,
    overlayOpacity: 0.5,
    animate: !parado,
    smoothScroll: !parado,
  };
}

/**
 * Botão "Guia" da barra do topo. Sem trilha no módulo, abre direto o passo a
 * passo da tela; com trilha (ex.: Tickets), abre um menu: o guia da tela ou
 * o processo de ponta a ponta, que atravessa telas. Não abre sozinho; um
 * ponto verde avisa guia ou trilha que a pessoa ainda não viu (ou que
 * mudou). Atalho: tecla "?" (guia da tela).
 */
export function BotaoGuia() {
  const pathname = usePathname();
  const router = useRouter();
  const atual = useMemo(() => guiaDa(pathname), [pathname]);
  const trilhas = useMemo(() => trilhasDa(pathname), [pathname]);
  const [novo, setNovo] = useState(false);
  const [menu, setMenu] = useState(false);
  const ativo = useRef<Driver | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const trilha = useRef<ReturnType<typeof criarTrilha> | null>(null);

  const motor = useCallback(() => {
    trilha.current ??= criarTrilha({
      base: configBase(),
      navegar: (rota) => router.push(rota),
    });
    return trilha.current;
  }, [router]);

  useEffect(() => {
    setNovo(
      (!!atual && !jaViu(atual.chave, atual.guia.versao)) ||
        trilhas.some((t) => !jaViu(`trilha:${t.id}`, t.versao)),
    );
    setMenu(false);
    // Mudou de tela com o guia aberto: fecha, os pontos eram da tela anterior.
    return () => ativo.current?.destroy();
  }, [atual, trilhas]);

  // Trilha em andamento: a tela nova retoma do passo gravado. Se a pessoa
  // foi para outra tela por conta própria, a trilha acaba.
  useEffect(() => {
    const andamento = trilhaEmAndamento();
    if (!andamento) return;
    const t = TRILHAS.find((x) => x.id === andamento.id);
    if (!t || rotaDoPasso(t, andamento.i) !== pathname) {
      trilha.current?.encerrar();
      return;
    }
    void motor().mostrar(t, andamento.i);
  }, [pathname, motor]);

  const abrirTela = useCallback(async () => {
    setMenu(false);
    if (!atual || ativo.current?.isActive()) return;
    trilha.current?.encerrar();
    const { driver } = await import("driver.js");
    const passos: DriveStep[] = atual.passos.flatMap((p) => {
      const popover = { title: p.titulo, description: p.texto };
      if (!p.alvo) return [{ popover }];
      const element = alvoNaTela(p.alvo);
      return element ? [{ element, popover }] : [];
    });
    const d = driver({
      ...configBase(),
      steps: passos,
      showProgress: passos.length > 1,
      progressText: "{{current}} de {{total}}",
      onDestroyed: () => {
        ativo.current = null;
        marcarVisto(atual.chave, atual.guia.versao);
        setNovo(trilhas.some((t) => !jaViu(`trilha:${t.id}`, t.versao)));
      },
    });
    ativo.current = d;
    d.drive();
  }, [atual, trilhas]);

  function abrirTrilha(id: string) {
    setMenu(false);
    const t = TRILHAS.find((x) => x.id === id);
    if (!t) return;
    ativo.current?.destroy();
    marcarVisto(`trilha:${t.id}`, t.versao);
    setNovo(!!atual && !jaViu(atual.chave, atual.guia.versao));
    void motor().mostrar(t, 0);
  }

  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      if (e.key !== "?" || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable='true']"))
        return;
      e.preventDefault();
      void abrirTela();
    };
    document.addEventListener("keydown", atalho);
    return () => document.removeEventListener("keydown", atalho);
  }, [abrirTela]);

  // Menu: fecha ao clicar fora ou no Esc.
  useEffect(() => {
    if (!menu) return;
    const fora = (e: PointerEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setMenu(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);

  if (!atual && trilhas.length === 0) return null;

  return (
    <div ref={caixa} className="relative shrink-0">
      <button
        type="button"
        data-guia="guia"
        onClick={() => (trilhas.length ? setMenu((m) => !m) : abrirTela())}
        aria-keyshortcuts="?"
        aria-haspopup={trilhas.length ? "menu" : undefined}
        aria-expanded={trilhas.length ? menu : undefined}
        title="Guia (tecla ? abre o desta tela)"
        className="vidro relative flex items-center gap-2 rounded-full p-1.5 text-sm text-neutral-700 transition hover:text-neutral-900 sm:pr-4"
      >
        <span className="grid size-8 place-items-center rounded-full bg-neutral-900 text-white">
          <Compass className="size-4" aria-hidden />
        </span>
        <span className="sr-only sm:not-sr-only">Guia</span>
        {novo && (
          <span className="absolute top-0.5 right-0.5 flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-marca opacity-75 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2.5 rounded-full bg-marca ring-2 ring-white" />
            <span className="sr-only">(novo)</span>
          </span>
        )}
      </button>

      {menu && (
        <div
          role="menu"
          className="vidro absolute top-full left-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-3xl p-1.5"
        >
          {atual && (
            <button
              type="button"
              role="menuitem"
              onClick={() => void abrirTela()}
              className="flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition hover:bg-neutral-900/[0.05]"
            >
              <SquareMousePointer
                className="mt-0.5 size-4 shrink-0 text-neutral-500"
                aria-hidden
              />
              <span>
                <span className="block font-medium">Guia desta tela</span>
                <span className="block text-xs text-neutral-500">
                  O que cada parte da tela faz
                </span>
              </span>
            </button>
          )}
          <p className="px-3 pt-2 pb-1 text-[11px] font-medium tracking-wider text-neutral-400 uppercase">
            Processo completo
          </p>
          {trilhas.map((t) => (
            <button
              key={t.id}
              type="button"
              role="menuitem"
              onClick={() => abrirTrilha(t.id)}
              className="flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition hover:bg-neutral-900/[0.05]"
            >
              <Route
                className="mt-0.5 size-4 shrink-0 text-marca-escuro"
                aria-hidden
              />
              <span>
                <span className="block font-medium">{t.titulo}</span>
                <span className="block text-xs text-neutral-500">
                  {t.resumo} · {t.passos.length} passos
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
