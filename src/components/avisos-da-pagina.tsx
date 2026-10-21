"use client";

import {
  ArrowRight,
  ChevronDown,
  FlaskConical,
  Info,
  TriangleAlert,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Avisos de uma página (o que falta para um número sair completo): sobem no
// canto inferior direito ao abrir a tela; cada um pode ser fechado, e o
// grupo pode ser minimizado numa bolinha. Fechar vale só para esta visita;
// ao voltar à página, o que continuar pendente aparece de novo.

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
  // Minimizado: os cartões viram uma bolinha no canto; clicar nela reabre.
  const [minimizado, setMinimizado] = useState(false);
  const [recolhendo, setRecolhendo] = useState(false);
  useEffect(() => setMontado(true), []);

  const visiveis = avisos.filter((a) => !fechados.has(a.id));

  function fechar(ids: string[]) {
    setSaindo((s) => new Set([...s, ...ids]));
    setTimeout(() => {
      setFechados((f) => new Set([...f, ...ids]));
      setSaindo((s) => new Set([...s].filter((id) => !ids.includes(id))));
    }, SAIDA_MS);
  }

  function minimizar() {
    setRecolhendo(true);
    setTimeout(() => {
      setMinimizado(true);
      setRecolhendo(false);
    }, SAIDA_MS);
  }

  if (!montado || visiveis.length === 0) return null;

  if (minimizado) {
    // A bolinha mostra o ícone do aviso mais importante e quantos são.
    const principal =
      visiveis.find((a) => a.tipo === "atencao") ??
      visiveis.find((a) => a.tipo === "info") ??
      visiveis[0];
    const { icone: Icone } = ESTILO[principal?.tipo ?? "info"];
    return createPortal(
      <button
        type="button"
        onClick={() => setMinimizado(false)}
        aria-label={`Abrir ${visiveis.length} ${visiveis.length > 1 ? "avisos" : "aviso"} desta página`}
        title="Abrir avisos"
        className="aviso-bolha fixed right-4 bottom-4 z-[60] grid size-14 place-items-center rounded-full bg-neutral-900 text-white shadow-[0_18px_36px_-12px_rgb(0_0_0/0.5)] ring-1 ring-white/10 transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca md:right-6 md:bottom-6"
      >
        <span
          aria-hidden
          className="aviso-bolha-onda absolute inset-0 rounded-full bg-marca/40"
        />
        <Icone className="relative size-5" aria-hidden />
        <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-marca px-1.5 text-[11px] font-semibold text-[#fff] ring-2 ring-white">
          {visiveis.length}
        </span>
      </button>,
      document.body,
    );
  }

  return createPortal(
    <section
      aria-label="Avisos desta página"
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col items-stretch gap-2.5 md:right-6 md:bottom-6"
    >
      <div
        data-saindo={recolhendo || undefined}
        className="aviso-entrar pointer-events-auto flex items-center gap-1 self-end rounded-full bg-neutral-900/80 py-1 pr-1 pl-3 text-xs text-white shadow-lg backdrop-blur-md"
      >
        <span className="mr-1">
          {visiveis.length}{" "}
          {visiveis.length > 1 ? "avisos nesta página" : "aviso nesta página"}
        </span>
        {visiveis.length > 1 && (
          <button
            type="button"
            onClick={() => fechar(visiveis.map((a) => a.id))}
            className="rounded-full bg-white/15 px-2.5 py-1 font-medium transition hover:bg-white/25"
          >
            Fechar todos
          </button>
        )}
        <button
          type="button"
          onClick={minimizar}
          aria-label="Minimizar avisos"
          title="Minimizar"
          className="grid size-6 place-items-center rounded-full bg-white/15 transition hover:bg-white/25"
        >
          <ChevronDown className="size-3.5" aria-hidden />
        </button>
      </div>
      {visiveis.map((a, i) => {
        const { icone: Icone, cor, rotulo } = ESTILO[a.tipo];
        return (
          <article
            key={a.id}
            data-saindo={saindo.has(a.id) || recolhendo || undefined}
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
