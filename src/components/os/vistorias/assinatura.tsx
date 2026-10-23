"use client";

import { Eraser, Loader, PenLine, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  removerAssinatura,
  salvarAssinatura,
} from "@/app/(app)/os/vistorias/actions";
import { ModalConfirmacao } from "@/components/modal-confirmacao";

// Assinatura feita na tela, com o dedo ou a caneta. Vira um PNG no bucket e
// sai no laudo sobre a linha da parte; sem ela, a linha fica em branco para
// assinar no papel.

const ALTURA = 170;

export function Assinatura({
  vistoriaId,
  parte,
  papel,
  nome,
  url,
}: {
  vistoriaId: string;
  parte: "locador" | "locatario";
  /** "LOCADOR (A)" ou "LOCATÁRIO (A)". */
  papel: string;
  nome: string;
  url: string | null;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const [vazia, setVazia] = useState(true);
  const [atual, setAtual] = useState(url);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [refazer, setRefazer] = useState(false);
  const [apagando, setApagando] = useState(false);
  const vaziaRef = useRef(vazia);
  vaziaRef.current = vazia;

  // O quadro acompanha a largura da tela, com nitidez de tela retina.
  useEffect(() => {
    if (atual) return;
    const c = canvas.current;
    if (!c) return;
    const preparar = () => {
      const escala = window.devicePixelRatio || 1;
      const largura = c.clientWidth;
      c.width = Math.round(largura * escala);
      c.height = Math.round(ALTURA * escala);
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.scale(escala, escala);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111";
      setVazia(true);
    };
    preparar();
    const observador = new ResizeObserver(() => {
      // Mudar o tamanho apaga o desenho: só refaz se ainda estiver vazio.
      if (vaziaRef.current) preparar();
    });
    observador.observe(c);
    return () => observador.disconnect();
  }, [atual]);
  function ponto(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function comecar(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    desenhando.current = true;
    const p = ponto(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.1, p.y + 0.1);
    ctx.stroke();
    setVazia(false);
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = ponto(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function parar() {
    desenhando.current = false;
  }

  function limpar() {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.restore();
    setVazia(true);
  }

  async function salvar() {
    const c = canvas.current;
    if (!c || vazia) return;
    setEnviando(true);
    setErro(null);
    const blob = await new Promise<Blob | null>((ok) =>
      c.toBlob(ok, "image/png"),
    );
    if (!blob) {
      setEnviando(false);
      setErro("Não foi possível ler a assinatura. Tente de novo.");
      return;
    }
    const form = new FormData();
    form.set("vistoria_id", vistoriaId);
    form.set("parte", parte);
    form.set(
      "arquivo",
      new File([blob], `assinatura-${parte}.png`, { type: "image/png" }),
    );
    const r = await salvarAssinatura(form);
    setEnviando(false);
    if (r.erro) setErro(r.erro);
    else setAtual(r.url ?? null);
  }

  async function apagar() {
    setApagando(true);
    const r = await removerAssinatura({ vistoriaId, parte });
    setApagando(false);
    setRefazer(false);
    if (r.erro) setErro(r.erro);
    else setAtual(null);
  }

  const botao =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-800 transition hover:border-neutral-400 disabled:opacity-50";

  return (
    <figure className="flex min-w-0 flex-col gap-2">
      {atual ? (
        <div className="grid h-[170px] place-items-center rounded-2xl border border-neutral-200 bg-white">
          {/* biome-ignore lint/performance/noImgElement: endereço assinado e temporário do bucket */}
          <img
            src={atual}
            alt={`Assinatura de ${nome || papel}`}
            className="max-h-[150px] max-w-full object-contain"
          />
        </div>
      ) : (
        <canvas
          ref={canvas}
          aria-label={`Quadro para ${nome || papel} assinar com o dedo ou a caneta`}
          role="img"
          className="h-[170px] w-full touch-none rounded-2xl border border-dashed border-neutral-300 bg-white"
          onPointerDown={comecar}
          onPointerMove={mover}
          onPointerUp={parar}
          onPointerCancel={parar}
          onPointerLeave={parar}
        />
      )}
      <figcaption className="flex flex-col items-center gap-0.5 border-t border-neutral-900 pt-2 text-center">
        <span className="text-sm font-semibold uppercase">
          {nome || "Sem nome"}
        </span>
        <span className="text-xs text-neutral-500">{papel}</span>
      </figcaption>
      <div className="flex flex-wrap justify-center gap-2">
        {atual ? (
          <button
            type="button"
            className={botao}
            onClick={() => setRefazer(true)}
          >
            <RotateCcw className="size-4" aria-hidden />
            Refazer assinatura
          </button>
        ) : (
          <>
            <button
              type="button"
              className={botao}
              onClick={limpar}
              disabled={vazia || enviando}
            >
              <Eraser className="size-4" aria-hidden />
              Limpar
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={vazia || enviando}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-neutral-900 px-4 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
            >
              {enviando ? (
                <Loader
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden
                />
              ) : (
                <PenLine className="size-4" aria-hidden />
              )}
              {enviando ? "Salvando…" : "Salvar assinatura"}
            </button>
          </>
        )}
      </div>
      {erro && (
        <p role="alert" className="text-center text-xs text-red-700">
          {erro}
        </p>
      )}
      <ModalConfirmacao
        aberto={refazer}
        pergunta="Apagar esta assinatura? A pessoa assina de novo na tela."
        rotulo="Apagar"
        rotuloEnviando="Apagando…"
        perigo
        enviando={apagando}
        aoConfirmar={apagar}
        aoFechar={() => setRefazer(false)}
      />
    </figure>
  );
}
