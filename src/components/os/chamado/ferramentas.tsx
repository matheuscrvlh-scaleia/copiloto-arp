"use client";

import {
  Bell,
  BellOff,
  Copy,
  Ellipsis,
  History,
  Link2,
  MessageCircle,
  Printer,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { classeCampo } from "@/components/estilos";
import { PILULA_OPCAO } from "@/components/os/novo/repetir";
import { Selecao } from "@/components/selecao";
import { limparTelefone, linkWhatsApp } from "@/lib/os/whatsapp";
import { seguirChamado } from "@/server/os/acoes/chamados";
import { BOTAO_PRIMARIO, Janela } from "./janela";

// Ferramentas do chamado (ou da OS), numa barra no topo: Seguir, WhatsApp e
// Imprimir à mão; duplicar, criar vinculado, abrir OS ligada e histórico
// no menu "Mais". Cada uma só aparece para quem pode usá-la.

const ICONE =
  "grid size-10 shrink-0 place-items-center rounded-full text-neutral-600 transition hover:bg-neutral-900/[0.06] hover:text-neutral-900 aria-pressed:bg-neutral-900/[0.06] aria-pressed:text-neutral-900 aria-expanded:bg-neutral-900/[0.06] disabled:opacity-60";
const ITEM =
  "flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm font-medium whitespace-nowrap text-neutral-800 transition hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:outline-none";

export interface ContatoWhatsApp {
  rotulo: string;
  telefone: string;
  descricao?: string;
}

export function Ferramentas({
  id,
  links,
  sigo,
  whatsapp,
}: {
  id: string;
  links: {
    imprimir: string;
    duplicar: string;
    /** Chamado ligado a este chamado (null na OS). */
    vinculado: string | null;
    /** OS nova ligada a este chamado (null na OS). */
    ordem: string | null;
    historico: string | null;
  };
  sigo: boolean;
  /** null: a OS tem o próprio WhatsApp, com a mensagem da OS. */
  whatsapp: {
    mensagem: string;
    sugeridos: ContatoWhatsApp[];
    contatos: ContatoWhatsApp[];
  } | null;
}) {
  const [zap, setZap] = useState(false);
  const [mais, setMais] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const [estado, seguir, seguindo] = useActionState(seguirChamado, {});

  useEffect(() => {
    if (!mais) return;
    caixa.current
      ?.querySelector<HTMLElement>("[role=menu] a, [role=menu] button")
      ?.focus();
    const fora = (e: PointerEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setMais(false);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [mais]);

  return (
    <nav
      aria-label="Ferramentas do chamado"
      className="flex flex-col items-end"
    >
      <div className="flex items-center gap-0.5">
        <form action={seguir}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="ligar" value={sigo ? "0" : "1"} />
          <button
            type="submit"
            disabled={seguindo}
            aria-pressed={sigo}
            aria-label={sigo ? "Deixar de seguir" : "Seguir (receber avisos)"}
            title={sigo ? "Deixar de seguir" : "Seguir (receber avisos)"}
            className={ICONE}
          >
            {sigo ? (
              <BellOff className="size-[18px]" aria-hidden />
            ) : (
              <Bell className="size-[18px]" aria-hidden />
            )}
          </button>
        </form>
        {whatsapp && (
          <button
            type="button"
            onClick={() => setZap(true)}
            aria-label="Enviar pelo WhatsApp"
            title="Enviar pelo WhatsApp"
            className={ICONE}
          >
            <MessageCircle className="size-[18px]" aria-hidden />
          </button>
        )}
        <a
          href={links.imprimir}
          target="_blank"
          rel="noopener"
          aria-label="Imprimir ou PDF"
          title="Imprimir ou PDF"
          className={ICONE}
        >
          <Printer className="size-[18px]" aria-hidden />
        </a>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: só segura o Esc do menu para não fechar a janela lateral */}
        <div
          ref={caixa}
          className="relative"
          onKeyDown={(e) => {
            if (e.key !== "Escape" || !mais) return;
            e.stopPropagation();
            setMais(false);
            caixa.current?.querySelector<HTMLElement>("button")?.focus();
          }}
        >
          <button
            type="button"
            onClick={() => setMais((m) => !m)}
            aria-haspopup="menu"
            aria-expanded={mais}
            aria-label="Mais ferramentas"
            title="Mais ferramentas"
            className={ICONE}
          >
            <Ellipsis className="size-[18px]" aria-hidden />
          </button>
          {mais && (
            <div
              role="menu"
              className="absolute top-full right-0 z-30 mt-1.5 flex min-w-56 flex-col rounded-2xl bg-white p-1.5 shadow-lg ring-1 ring-neutral-900/[0.08]"
            >
              <Link role="menuitem" href={links.duplicar} className={ITEM}>
                <Copy className="size-4 text-neutral-500" aria-hidden />
                Duplicar
              </Link>
              {links.vinculado && (
                <Link role="menuitem" href={links.vinculado} className={ITEM}>
                  <Link2 className="size-4 text-neutral-500" aria-hidden />
                  Criar chamado vinculado
                </Link>
              )}
              {links.ordem && (
                <Link role="menuitem" href={links.ordem} className={ITEM}>
                  <Wrench className="size-4 text-neutral-500" aria-hidden />
                  Abrir OS ligada
                </Link>
              )}
              {links.historico && (
                <Link role="menuitem" href={links.historico} className={ITEM}>
                  <History className="size-4 text-neutral-500" aria-hidden />
                  Histórico de alterações
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
      {estado.erro && (
        <p role="alert" className="px-3 text-xs text-red-700">
          {estado.erro}
        </p>
      )}

      {whatsapp && (
        <JanelaWhatsApp
          aberta={zap}
          aoFechar={() => setZap(false)}
          {...whatsapp}
        />
      )}
    </nav>
  );
}

function JanelaWhatsApp({
  aberta,
  aoFechar,
  mensagem: inicial,
  sugeridos,
  contatos,
}: {
  aberta: boolean;
  aoFechar: () => void;
  mensagem: string;
  sugeridos: ContatoWhatsApp[];
  contatos: ContatoWhatsApp[];
}) {
  const id = useId();
  const [telefone, setTelefone] = useState("");
  const [mensagem, setMensagem] = useState(inicial);
  const numero = telefone ? limparTelefone(telefone) : null;
  const invalido = Boolean(telefone.trim()) && !numero;

  return (
    <Janela
      aberta={aberta}
      aoFechar={aoFechar}
      titulo="Enviar pelo WhatsApp"
      descricao="Abre o WhatsApp com a mensagem pronta; quem envia é você."
    >
      <div className="flex flex-col gap-4">
        {sugeridos.length > 0 && (
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-neutral-600">
              Para
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {sugeridos.map((s) => (
                <button
                  key={`${s.rotulo}-${s.telefone}`}
                  type="button"
                  aria-pressed={telefone === s.telefone}
                  onClick={() => setTelefone(s.telefone)}
                  className={PILULA_OPCAO}
                >
                  {s.rotulo}
                  {s.descricao && (
                    <span className="opacity-60">· {s.descricao}</span>
                  )}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {contatos.length > 0 && (
          <label
            htmlFor={`${id}-contato`}
            className="flex flex-col gap-1.5 text-xs font-medium text-neutral-600"
          >
            Contato salvo
            <Selecao
              id={`${id}-contato`}
              busca
              valor={
                contatos.some((c) => c.telefone === telefone) ? telefone : ""
              }
              aoMudar={setTelefone}
              placeholder="Escolher contato…"
              opcoes={contatos.map((c) => ({
                valor: c.telefone,
                rotulo: c.rotulo,
                descricao: c.descricao,
              }))}
            />
          </label>
        )}
        <label
          htmlFor={`${id}-numero`}
          className="flex flex-col gap-1.5 text-xs font-medium text-neutral-600"
        >
          Número
          <input
            id={`${id}-numero`}
            type="tel"
            inputMode="tel"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="(22) 99999-0000 — vazio: escolhe no WhatsApp"
            className={`${classeCampo} min-h-11`}
          />
          {invalido && (
            <span role="alert" className="font-normal text-red-700">
              Número incompleto: use DDD + número.
            </span>
          )}
        </label>
        <label
          htmlFor={`${id}-msg`}
          className="flex flex-col gap-1.5 text-xs font-medium text-neutral-600"
        >
          Mensagem
          <textarea
            id={`${id}-msg`}
            rows={8}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            className={`${classeCampo} resize-y font-mono text-[13px]`}
          />
        </label>
        <div className="flex justify-end">
          <a
            href={invalido ? undefined : linkWhatsApp(numero, mensagem)}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={invalido}
            onClick={(e) => {
              if (invalido) e.preventDefault();
              else aoFechar();
            }}
            className={`${BOTAO_PRIMARIO} aria-disabled:opacity-50`}
          >
            <MessageCircle className="size-4" aria-hidden />
            Abrir WhatsApp
          </a>
        </div>
      </div>
    </Janela>
  );
}
