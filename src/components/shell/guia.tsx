"use client";

import "driver.js/dist/driver.css";
import type { Driver, DriveStep } from "driver.js";
import { Compass } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { chaveVisto, guiaDa, type Passo } from "@/config/guias";

/** O primeiro elemento visível com o alvo (fora: gaveta fechada, sem permissão, sem dado). */
function alvoNaTela(alvo: NonNullable<Passo["alvo"]>): Element | undefined {
  const [tipo, titulo] = alvo.split(/:(.*)/s);
  const seletor = titulo
    ? `[data-guia="${tipo}"][data-guia-titulo="${CSS.escape(titulo)}"]`
    : `[data-guia="${alvo}"]`;
  return [...document.querySelectorAll(seletor)].find(
    (el) => el.getClientRects().length > 0,
  );
}

function marcarVisto(chave: string, versao: number) {
  try {
    localStorage.setItem(chaveVisto(chave), String(versao));
  } catch {
    // Sem armazenamento: o ponto de novidade volta ao recarregar.
  }
}

/**
 * Botão "Guia" da barra do topo: abre o passo a passo da tela atual. Não abre
 * sozinho; um ponto verde avisa quando há guia que a pessoa ainda não viu (ou
 * que mudou). Atalho: tecla "?". Passo cujo ponto não está na tela (sem
 * permissão, sem dado, menu recolhido no celular) é pulado, e a contagem
 * "2 de 5" conta só o que aparece.
 */
export function BotaoGuia() {
  const pathname = usePathname();
  const atual = useMemo(() => guiaDa(pathname), [pathname]);
  const [novo, setNovo] = useState(false);
  const ativo = useRef<Driver | null>(null);

  useEffect(() => {
    if (!atual) return;
    try {
      setNovo(
        localStorage.getItem(chaveVisto(atual.chave)) !==
          String(atual.guia.versao),
      );
    } catch {
      setNovo(false);
    }
    // Mudou de tela com o guia aberto: fecha, os pontos eram da tela anterior.
    return () => ativo.current?.destroy();
  }, [atual]);

  const abrir = useCallback(async () => {
    if (!atual || ativo.current?.isActive()) return;
    const { driver } = await import("driver.js");
    const passos: DriveStep[] = atual.passos.flatMap((p) => {
      const popover = { title: p.titulo, description: p.texto };
      if (!p.alvo) return [{ popover }];
      const element = alvoNaTela(p.alvo);
      return element ? [{ element, popover }] : [];
    });
    const parado = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const d = driver({
      steps: passos,
      showProgress: passos.length > 1,
      progressText: "{{current}} de {{total}}",
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
      onDestroyed: () => {
        ativo.current = null;
        marcarVisto(atual.chave, atual.guia.versao);
        setNovo(false);
      },
    });
    ativo.current = d;
    d.drive();
  }, [atual]);

  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      if (e.key !== "?" || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable='true']"))
        return;
      e.preventDefault();
      abrir();
    };
    document.addEventListener("keydown", atalho);
    return () => document.removeEventListener("keydown", atalho);
  }, [abrir]);

  if (!atual) return null;

  return (
    <button
      type="button"
      data-guia="guia"
      onClick={abrir}
      aria-keyshortcuts="?"
      title="Guia desta tela (tecla ?)"
      className="vidro relative flex shrink-0 items-center gap-2 rounded-full p-1.5 text-sm text-neutral-700 transition hover:text-neutral-900 sm:pr-4"
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
  );
}
