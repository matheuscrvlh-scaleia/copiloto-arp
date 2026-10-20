"use client";

import {
  ArrowRight,
  FlaskConical,
  Info,
  TriangleAlert,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Avisos de uma página (o que falta para um número sair completo): sobem no
// canto inferior direito ao abrir a tela e cada um pode ser fechado. Fechar
// vale só para esta visita; ao voltar à página, o que continuar pendente
// aparece de novo.

export interface AvisoDaPagina {
  /** Estável entre visitas (ex.: "rat-fap"). */
  id: string;
  tipo: "atencao" | "info" | "prototipo";
  titulo: string;
  texto: string;
  acao?: { href: string; rotulo: string };
}

const ESTILO: Record<
  AvisoDaPagina["tipo"],
  { icone: typeof Info; cor: string; rotulo: string }
> = {
  atencao: {
    icone: TriangleAlert,
    cor: "bg-amber-400/20 text-amber-700",
    rotulo: "Atenção",
  },
  info: { icone: Info, cor: "bg-sky-400/20 text-sky-700", rotulo: "Aviso" },
  prototipo: {
    icone: FlaskConical,
    cor: "bg-violet-400/20 text-violet-700",
    rotulo: "Protótipo",
  },
};

const SAIDA_MS = 220;

export function AvisosDaPagina({ avisos }: { avisos: AvisoDaPagina[] }) {
  // O portal só existe no navegador; no <body> o fixed não fica preso a um
  // ancestral de vidro (backdrop-filter cria um novo bloco de contenção).
  const [montado, setMontado] = useState(false);
  const [fechados, setFechados] = useState<Set<string>>(new Set());
  const [saindo, setSaindo] = useState<Set<string>>(new Set());
  useEffect(() => setMontado(true), []);

  const visiveis = avisos.filter((a) => !fechados.has(a.id));

  function fechar(ids: string[]) {
    setSaindo((s) => new Set([...s, ...ids]));
    setTimeout(() => {
      setFechados((f) => new Set([...f, ...ids]));
      setSaindo((s) => new Set([...s].filter((id) => !ids.includes(id))));
    }, SAIDA_MS);
  }

  if (!montado || visiveis.length === 0) return null;

  return createPortal(
    <section
      aria-label="Avisos desta página"
      className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col items-stretch gap-2.5 md:right-6 md:bottom-6"
    >
      {visiveis.length > 1 && (
        <div className="aviso-entrar pointer-events-auto flex items-center justify-between self-end rounded-full bg-neutral-900/80 py-1 pr-1 pl-3 text-xs text-white shadow-lg backdrop-blur-md">
          <span>{visiveis.length} avisos nesta página</span>
          <button
            type="button"
            onClick={() => fechar(visiveis.map((a) => a.id))}
            className="ml-2 rounded-full bg-white/15 px-2.5 py-1 font-medium transition hover:bg-white/25"
          >
            Fechar todos
          </button>
        </div>
      )}
      {visiveis.map((a, i) => {
        const { icone: Icone, cor, rotulo } = ESTILO[a.tipo];
        return (
          <article
            key={a.id}
            role="status"
            data-saindo={saindo.has(a.id) || undefined}
            style={{ animationDelay: `${120 + i * 90}ms` }}
            className="aviso-entrar vidro pointer-events-auto relative flex gap-3 overflow-hidden rounded-3xl p-4 pr-11 shadow-[0_24px_48px_-24px_rgb(0_0_0/0.35)]"
          >
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-2xl ${cor}`}
            >
              <Icone className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-neutral-500 uppercase">
                {rotulo}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-neutral-900">
                {a.titulo}
              </p>
              <p className="mt-0.5 text-[13px] leading-snug text-neutral-600">
                {a.texto}
              </p>
              {a.acao && (
                <Link
                  href={a.acao.href}
                  className="group mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-800"
                >
                  {a.acao.rotulo}
                  <ArrowRight
                    className="size-3.5 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              )}
            </div>
            <button
              type="button"
              onClick={() => fechar([a.id])}
              aria-label={`Fechar aviso: ${a.titulo}`}
              className="absolute top-3 right-3 grid size-7 place-items-center rounded-full text-neutral-500 transition hover:bg-neutral-900/[0.07] hover:text-neutral-900"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </article>
        );
      })}
    </section>,
    document.body,
  );
}
