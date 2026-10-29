"use client";

import { Camera, MessageSquare, Paperclip } from "lucide-react";
import Link from "next/link";
import { useAtributos, usePonte } from "@/components/os/arraste/ponte";
import { IconeTipo, SeloPrazo } from "@/components/os/selos";
import { iniciais } from "@/lib/formato";
import type { LinhaChamado } from "@/lib/os/lista";
import { numeroDo } from "@/lib/os/numeros";
import { MOTIVOS_AGUARDANDO, PRIORIDADES, TIPOS } from "@/lib/os/rotulos";

// Cartão do quadro: número, categoria, título, prioridade alta/urgente,
// prazo relativo, responsável (iniciais) e as contagens de fotos, anexos e
// conversa. Arrasta pelo cartão todo; o título abre o detalhe ao lado. O
// arrastar vem do motor carregado depois (components/os/arraste): aqui o
// cartão só se cadastra na ponte e repassa os eventos.

const COR_PRIORIDADE = {
  alta: "bg-amber-50 text-amber-900",
  urgente: "bg-red-50 text-red-700",
} as const;

export function CartaoDoQuadro({
  c,
  agora,
  avisoHoras,
  href,
  flutuando = false,
  arrastado = false,
}: {
  c: LinhaChamado;
  agora: Date;
  avisoHoras: number;
  href: string;
  /** Cópia que segue o ponteiro durante o arraste. */
  flutuando?: boolean;
  /** É o cartão que está sendo arrastado (fica apagado no lugar). */
  arrastado?: boolean;
}) {
  const ponte = usePonte();
  const attributes = useAtributos(arrastado);
  const n = c.contagens;
  const urgencia =
    c.prioridade === "alta" || c.prioridade === "urgente" ? c.prioridade : null;

  return (
    <article
      ref={flutuando ? undefined : ponte.arrastavel(c.id)}
      {...(flutuando ? {} : attributes)}
      {...(flutuando ? {} : ponte.eventos(c.id))}
      aria-roledescription="cartão arrastável"
      aria-label={`${numeroDo(c)} ${c.titulo}`}
      className={`flex touch-manipulation flex-col gap-2 rounded-2xl border border-neutral-900/[0.06] bg-white/80 p-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-marca ${arrastado ? "opacity-30" : ""} ${flutuando ? "rotate-1 cursor-grabbing shadow-[0_24px_48px_-20px_rgb(0_0_0/0.5)]" : "cursor-grab hover:border-neutral-900/20 hover:bg-white"}`}
    >
      <div className="flex items-center gap-1.5 text-xs text-neutral-500">
        <span title={TIPOS[c.tipo]} className="text-neutral-400">
          <IconeTipo tipo={c.tipo} className="size-3.5" />
          <span className="sr-only">{TIPOS[c.tipo]}</span>
        </span>
        <span className="tabular-nums">{numeroDo(c)}</span>
        {c.categoria && (
          <span className="min-w-0 truncate">· {c.categoria}</span>
        )}
        {urgencia && (
          <span
            className={`ml-auto shrink-0 rounded-full px-2 py-0.5 font-medium ${COR_PRIORIDADE[urgencia]}`}
          >
            {PRIORIDADES[urgencia]}
          </span>
        )}
      </div>
      <Link
        href={href}
        scroll={false}
        className="font-medium break-words text-neutral-900 underline-offset-2 hover:underline"
      >
        {c.titulo}
      </Link>
      {c.status === "aguardando" && c.aguardando && (
        <p className="text-xs text-amber-900">
          Aguardando {MOTIVOS_AGUARDANDO[c.aguardando].toLowerCase()}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <SeloPrazo
          prazo={c.prazo}
          status={c.status}
          agora={agora}
          avisoHoras={avisoHoras}
        />
      </div>
      <div className="flex items-center gap-3 text-xs text-neutral-500">
        {c.responsavel ? (
          <span
            title={`Responsável: ${c.responsavel}`}
            className="grid size-6 place-items-center rounded-full bg-violet-100 text-[10px] font-semibold text-violet-700"
          >
            {iniciais(c.responsavel)}
            <span className="sr-only">Responsável: {c.responsavel}</span>
          </span>
        ) : (
          <span className="rounded-full bg-neutral-900/[0.05] px-2 py-0.5">
            Na fila
          </span>
        )}
        <span className="ml-auto flex items-center gap-2.5">
          {n && n.fotos > 0 && (
            <Contagem Icone={Camera} n={n.fotos} rotulo="fotos" />
          )}
          {n && n.anexos > 0 && (
            <Contagem Icone={Paperclip} n={n.anexos} rotulo="anexos" />
          )}
          {n && n.comentarios > 0 && (
            <Contagem
              Icone={MessageSquare}
              n={n.comentarios}
              rotulo="comentários"
            />
          )}
        </span>
      </div>
    </article>
  );
}

function Contagem({
  Icone,
  n,
  rotulo,
}: {
  Icone: typeof Camera;
  n: number;
  rotulo: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 tabular-nums"
      title={`${n} ${rotulo}`}
    >
      <Icone className="size-3.5" aria-hidden />
      {n}
      <span className="sr-only">{rotulo}</span>
    </span>
  );
}
