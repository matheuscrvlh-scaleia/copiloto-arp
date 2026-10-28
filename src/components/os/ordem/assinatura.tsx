"use client";

import { Eraser, PenLine } from "lucide-react";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { classeCampo } from "@/components/estilos";
import { formatarDataHora } from "@/lib/formato";
import { botao, rotulo } from "./estilos";
import type { EstadoOS } from "./tipos";

// Assinatura na tela (dedo no celular, mouse no computador): a da ARP no
// detalhe da OS e a do terceirizado pelo link. Vira um PNG transparente
// que sai sobre a linha de assinatura no PDF da OS. `acao` recebe o PNG
// em "assinatura", o nome, o documento (se pedido) e os `campos`.

const ALTURA = 160;

export function Assinatura({
  acao,
  campos,
  podeEditar,
  atual,
  nomeSugerido,
  documento = false,
  bloqueio = null,
  rotuloSalvar = "Salvar assinatura",
}: {
  acao: (estado: EstadoOS, form: FormData) => Promise<EstadoOS>;
  campos: Record<string, string>;
  podeEditar: boolean;
  atual: { url: string | null; nome: string | null; em: string | null } | null;
  nomeSugerido: string;
  /** Pede também o CPF ou CNPJ de quem assina. */
  documento?: boolean;
  /** Por que ainda não dá para assinar (mostrado no lugar do quadro). */
  bloqueio?: string | null;
  rotuloSalvar?: string;
}) {
  const [estado, assinar, salvando] = useActionState<EstadoOS, FormData>(
    acao,
    {},
  );
  const [preparando, iniciar] = useTransition();
  const [assinando, setAssinando] = useState(!atual);
  const [vazio, setVazio] = useState(true);
  const [nome, setNome] = useState(atual?.nome ?? nomeSugerido);
  const [doc, setDoc] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);

  useEffect(() => {
    if (estado.ok) setAssinando(false);
  }, [estado]);

  // Tamanho real do quadro na tela (nítido em telas de alta densidade).
  useEffect(() => {
    const c = canvas.current;
    if (!assinando || !c) return;
    const escala = window.devicePixelRatio || 1;
    c.width = Math.round(c.clientWidth * escala);
    c.height = Math.round(ALTURA * escala);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(escala, escala);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111111";
    setVazio(true);
  }, [assinando]);

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
    setVazio(false);
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return;
    const ctx = e.currentTarget.getContext("2d");
    const p = ponto(e);
    ctx?.lineTo(p.x, p.y);
    ctx?.stroke();
  }

  function limpar() {
    const c = canvas.current;
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    setVazio(true);
  }

  function salvar() {
    const c = canvas.current;
    if (!c || vazio) return;
    iniciar(async () => {
      const blob = await new Promise<Blob | null>((ok) =>
        c.toBlob(ok, "image/png"),
      );
      if (!blob) return;
      const form = new FormData();
      for (const [k, v] of Object.entries(campos)) form.set(k, v);
      form.set("nome", nome);
      if (documento) form.set("documento", doc);
      form.set(
        "assinatura",
        new File([blob], "assinatura.png", { type: "image/png" }),
      );
      iniciar(() => assinar(form));
    });
  }

  if (!assinando && atual) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-center rounded-2xl border border-neutral-200 bg-[#fff] p-3">
          {atual.url ? (
            // biome-ignore lint/performance/noImgElement: endereço assinado e temporário do bucket
            <img
              src={atual.url}
              alt={`Assinatura de ${atual.nome ?? "responsável"}`}
              className="h-24 w-auto"
            />
          ) : (
            <span className="text-sm text-neutral-500">Assinatura salva</span>
          )}
        </div>
        <p className="text-xs text-neutral-500">
          {atual.nome}
          {atual.em && ` · ${formatarDataHora(atual.em)}`}
        </p>
        {podeEditar && (
          <button
            type="button"
            onClick={() => setAssinando(true)}
            className={`${botao.secundario} self-start`}
          >
            <PenLine className="size-4" aria-hidden />
            Assinar de novo
          </button>
        )}
        {estado.ok && (
          <output className="text-xs text-green-700">{estado.ok}</output>
        )}
      </div>
    );
  }

  if (!podeEditar)
    return <p className="text-sm text-neutral-500">Sem assinatura.</p>;
  if (bloqueio) return <p className="text-sm text-neutral-500">{bloqueio}</p>;

  return (
    <div className="flex flex-col gap-3">
      <label className={rotulo}>
        Nome de quem assina
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          maxLength={120}
          className={classeCampo}
        />
      </label>
      {documento && (
        <label className={rotulo}>
          CPF ou CNPJ (opcional)
          <input
            value={doc}
            onChange={(e) => setDoc(e.target.value)}
            inputMode="numeric"
            maxLength={30}
            className={classeCampo}
          />
        </label>
      )}
      <div className="relative">
        <canvas
          ref={canvas}
          aria-label="Quadro de assinatura: desenhe com o dedo ou o mouse"
          onPointerDown={comecar}
          onPointerMove={mover}
          onPointerUp={() => {
            desenhando.current = false;
          }}
          onPointerCancel={() => {
            desenhando.current = false;
          }}
          style={{ height: ALTURA }}
          className="block w-full touch-none rounded-2xl border border-neutral-300 bg-[#fff]"
        />
        {vazio && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-[#a3a3a3]">
            Assine aqui
          </span>
        )}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-dashed border-[#d4d4d4]"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={salvar}
          disabled={vazio || salvando || preparando || nome.trim().length < 2}
          className={botao.primario}
        >
          {salvando || preparando ? "Salvando…" : rotuloSalvar}
        </button>
        <button type="button" onClick={limpar} className={botao.secundario}>
          <Eraser className="size-4" aria-hidden />
          Limpar
        </button>
        {atual && (
          <button
            type="button"
            onClick={() => setAssinando(false)}
            className={botao.secundario}
          >
            Manter a anterior
          </button>
        )}
        {estado.erro && (
          <span role="alert" className="text-xs text-red-700">
            {estado.erro}
          </span>
        )}
      </div>
    </div>
  );
}
