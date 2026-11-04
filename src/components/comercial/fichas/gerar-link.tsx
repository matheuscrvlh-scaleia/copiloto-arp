"use client";

import { Check, Copy, Link2, MessageCircle, X } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { classeCampo } from "@/components/estilos";
import { useEnvioSemLimpar } from "@/components/form-acao";
import {
  LUC_NAO_SEI,
  ROTULO_TIPO_CURTO,
  TIPOS_FICHA,
} from "@/lib/comercial/ficha";
import {
  type EstadoDoLink,
  gerarLinkFicha,
} from "@/server/comercial/acoes/fichas";

// "Gerar link" da ficha cadastral: LUC pretendido (vagos do ENET ou "Ainda
// não sei"; vem marcado quando a tela abre com ?luc=, da Ocupação), tipo
// esperado e a oportunidade do RD. Gerado, o link fica na janela para
// copiar ou mandar pelo WhatsApp.

export const BOTAO_PRIMARIO =
  "inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60";
export const BOTAO_SECUNDARIO =
  "inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400 disabled:opacity-60";

/** Endereço com copiar e WhatsApp (mensagem pronta). */
export function LinkParaEnviar({
  link,
  validoAte,
}: {
  link: string;
  validoAte?: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const id = useId();
  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt("Copie o link da ficha:", link);
    }
  }
  const mensagem = `Olá! Para seguir com a locação no Espaço ARP, preencha a ficha cadastral por este link${validoAte ? ` (vale até ${validoAte})` : ""}: ${link}`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-xs font-medium text-neutral-600">
        Link para enviar ao interessado
      </label>
      <input
        id={id}
        readOnly
        value={link}
        onFocus={(e) => e.target.select()}
        className={`${classeCampo} font-mono text-xs`}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copiar} className={BOTAO_PRIMARIO}>
          {copiado ? (
            <Check className="size-4 text-green-400" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
          <span aria-live="polite">{copiado ? "Copiado" : "Copiar link"}</span>
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`}
          target="_blank"
          rel="noreferrer"
          className={BOTAO_SECUNDARIO}
        >
          <MessageCircle className="size-4" aria-hidden />
          Enviar pelo WhatsApp
        </a>
      </div>
    </div>
  );
}

export function GerarLink({
  lucs,
  validadeDias,
  lucInicial,
  abrirAoCarregar = false,
}: {
  lucs: { valor: string; rotulo: string }[];
  validadeDias: number;
  lucInicial?: string;
  abrirAoCarregar?: boolean;
}) {
  const [estado, executar, enviando] = useActionState<EstadoDoLink, FormData>(
    gerarLinkFicha,
    {},
  );
  const form = useRef<HTMLFormElement>(null);
  const aoEnviar = useEnvioSemLimpar(executar, estado, form);
  const [aberto, setAberto] = useState(abrirAoCarregar);
  const [gerado, setGerado] = useState<EstadoDoLink | null>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const ids = { luc: useId(), tipo: useId(), nome: useId(), rd: useId() };

  useEffect(() => {
    if (estado.link) setGerado(estado);
  }, [estado]);

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (aberto && !d.open) {
      d.showModal();
      document.documentElement.style.overflow = "hidden";
    } else if (!aberto && d.open) d.close();
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [aberto]);

  const fechar = () => {
    if (enviando) return;
    setAberto(false);
    setGerado(null);
  };
  const opcoes =
    lucInicial && !lucs.some((l) => l.valor === lucInicial)
      ? [{ valor: lucInicial, rotulo: lucInicial }, ...lucs]
      : lucs;

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-haspopup="dialog"
        className={BOTAO_PRIMARIO}
      >
        <Link2 className="size-4" aria-hidden />
        Gerar link
      </button>
      <dialog
        ref={dialogo}
        aria-labelledby={idTitulo}
        onCancel={(e) => {
          e.preventDefault();
          fechar();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) fechar();
        }}
        onKeyDown={() => undefined}
        className="modal-detalhe m-auto max-h-[min(90dvh,52rem)] w-[min(36rem,calc(100vw-1.5rem))] overflow-hidden rounded-[2rem] border-0 bg-transparent p-0 text-neutral-900 backdrop:bg-black/45 backdrop:backdrop-blur-md"
      >
        <form
          ref={form}
          onSubmit={aoEnviar}
          className="painel-modal flex max-h-[min(90dvh,52rem)] flex-col rounded-[2rem]"
        >
          <header className="relative shrink-0 px-6 pt-6 pb-3 pr-16">
            <h2 id={idTitulo} className="text-xl font-semibold tracking-tight">
              Gerar link da ficha cadastral
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Link único, sem login, válido por {validadeDias} dias. Quem abre
              vê só a própria ficha.
            </p>
            <button
              type="button"
              onClick={fechar}
              aria-label="Fechar"
              className="absolute top-5 right-5 grid size-10 place-items-center rounded-full bg-neutral-900 text-white transition hover:scale-105"
            >
              <X className="size-4" aria-hidden />
            </button>
          </header>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-3">
            {gerado?.link ? (
              <LinkParaEnviar link={gerado.link} validoAte={gerado.validoAte} />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor={ids.luc}
                    className="text-xs font-medium text-neutral-600"
                  >
                    LUC pretendido
                  </label>
                  <select
                    id={ids.luc}
                    name="luc"
                    defaultValue={lucInicial ?? LUC_NAO_SEI}
                    className={classeCampo}
                  >
                    <option value={LUC_NAO_SEI}>Ainda não sei</option>
                    {opcoes.map((l) => (
                      <option key={l.valor} value={l.valor}>
                        {l.rotulo}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor={ids.tipo}
                    className="text-xs font-medium text-neutral-600"
                  >
                    Tipo esperado
                  </label>
                  <select
                    id={ids.tipo}
                    name="tipo"
                    defaultValue="pj"
                    className={classeCampo}
                  >
                    {TIPOS_FICHA.map((t) => (
                      <option key={t} value={t}>
                        {ROTULO_TIPO_CURTO[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label
                    htmlFor={ids.nome}
                    className="text-xs font-medium text-neutral-600"
                  >
                    Para quem (opcional)
                  </label>
                  <input
                    id={ids.nome}
                    name="nome"
                    maxLength={150}
                    placeholder="Nome do interessado ou da empresa"
                    className={classeCampo}
                  />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label
                    htmlFor={ids.rd}
                    className="text-xs font-medium text-neutral-600"
                  >
                    Oportunidade no RD (referência)
                  </label>
                  <input
                    id={ids.rd}
                    name="rd"
                    maxLength={200}
                    placeholder="Opcional: nome ou número da oportunidade"
                    className={classeCampo}
                  />
                </div>
              </div>
            )}
          </div>
          <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-neutral-900/[0.06] px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
            {estado.erro && (
              <p role="alert" className="text-xs text-red-700 sm:mr-auto">
                {estado.erro}
              </p>
            )}
            {gerado?.link ? (
              <>
                <button
                  type="button"
                  onClick={() => setGerado(null)}
                  className={BOTAO_SECUNDARIO}
                >
                  Gerar outro
                </button>
                <button
                  type="button"
                  onClick={fechar}
                  className={BOTAO_PRIMARIO}
                >
                  Pronto
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={fechar}
                  disabled={enviando}
                  className={BOTAO_SECUNDARIO}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviando}
                  className={BOTAO_PRIMARIO}
                >
                  {enviando ? "Gerando…" : "Gerar link"}
                </button>
              </>
            )}
          </footer>
        </form>
      </dialog>
    </>
  );
}
