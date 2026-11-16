import { respostaSessao } from "@arp/shared/contratos/auth";
import { AVISO_DE_USO_MS, INATIVIDADE_MS } from "@arp/shared/sessao";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { sair } from "@/lib/sessao";

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
 * Quem mexe na tela avisa a API (POST /auth/uso, no máximo uma vez por
 * minuto), para quem passa muito tempo preenchendo um formulário não perder
 * a sessão: só esse aviso conta como uso (as consultas automáticas, não).
 * Após 30 min sem uso em nenhuma aba, encerra a sessão e leva ao login, e os
 * dados saem da tela.
 */
export function FimPorInatividade() {
  useEffect(() => {
    let ultimoUso = Date.now();
    let avisado = ultimoUso;
    let encerrando = false;

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
        // Sessão já vencida na API: o próprio aviso leva ao login.
        api
          .post("/auth/uso", undefined, { esquema: respostaSessao })
          .catch(() => undefined);
      }
    };
    const conferir = () => {
      const parado = Date.now() - Math.max(ultimoUso, ultimoUsoEmOutraAba());
      if (parado <= INATIVIDADE_MS || encerrando) return;
      encerrando = true;
      void sair("expirou");
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
