"use client";

import { useEffect } from "react";
import { AVISO_DE_USO_MS, INATIVIDADE_MS } from "@/config/sessao";

const CHAVE = "arp:ultimo-uso";
const EVENTOS = [
  "pointerdown",
  "pointermove",
  "keydown",
  "wheel",
  "touchstart",
];

function ultimoUsoEmOutraAba(): number {
  try {
    return Number(localStorage.getItem(CHAVE)) || 0;
  } catch {
    return 0;
  }
}

/**
 * Quem mexe na tela avisa o servidor (no máximo uma vez por minuto), para
 * quem passa muito tempo preenchendo um formulário não perder a sessão. Após
 * 30 min sem uso em nenhuma aba, recarrega: o proxy encerra a sessão e leva
 * ao login, e os dados saem da tela.
 */
export function FimPorInatividade() {
  useEffect(() => {
    let ultimoUso = Date.now();
    let avisado = ultimoUso;

    const usou = () => {
      const agora = Date.now();
      if (agora - ultimoUso < 5_000) return;
      ultimoUso = agora;
      try {
        localStorage.setItem(CHAVE, String(agora));
      } catch {
        // Sem localStorage, vale só o uso desta aba.
      }
      if (agora - avisado >= AVISO_DE_USO_MS) {
        avisado = agora;
        fetch("/api/sessao", { method: "POST" }).catch(() => undefined);
      }
    };
    const conferir = () => {
      const parado = Date.now() - Math.max(ultimoUso, ultimoUsoEmOutraAba());
      if (parado > INATIVIDADE_MS) window.location.reload();
    };

    for (const e of EVENTOS)
      window.addEventListener(e, usou, { passive: true, capture: true });
    document.addEventListener("visibilitychange", conferir);
    const timer = setInterval(conferir, 60_000);
    return () => {
      for (const e of EVENTOS)
        window.removeEventListener(e, usou, { capture: true });
      document.removeEventListener("visibilitychange", conferir);
      clearInterval(timer);
    };
  }, []);

  return null;
}
