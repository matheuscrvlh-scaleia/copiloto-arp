"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Info,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useReducer, useRef, useState } from "react";
import { iniciais } from "@/lib/formato";
import {
  type Detalhe,
  type LinhaDetalhe,
  pedidoDe,
  pedirTabelas,
  type TabelaDetalhe,
} from "./modal-detalhe";

// Janela do modal "quem forma este número" (ver modal-detalhe.tsx). Fica
// num arquivo à parte para ser baixada só depois da página.

function ordenar(
  linhas: LinhaDetalhe[],
  coluna: number,
  sentido: 1 | -1,
): LinhaDetalhe[] {
  const valor = (l: LinhaDetalhe) =>
    l.ordem?.[coluna] ?? l.celulas[coluna] ?? "";
  return [...linhas].sort((a, b) => {
    const x = valor(a);
    const y = valor(b);
    if (x === null) return 1;
    if (y === null) return -1;
    const r =
      typeof x === "number" && typeof y === "number"
        ? x - y
        : String(x).localeCompare(String(y), "pt-BR", { numeric: true });
    return r * sentido;
  });
}

const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function Tabela({ tabela, busca }: { tabela: TabelaDetalhe; busca: string }) {
  const [ordem, setOrdem] = useState<{
    coluna: number;
    sentido: 1 | -1;
  } | null>(null);
  const termo = sem(busca.trim());
  const filtradas = termo
    ? tabela.linhas.filter((l) => sem(l.celulas.join(" ")).includes(termo))
    : tabela.linhas;
  const linhas = ordem
    ? ordenar(filtradas, ordem.coluna, ordem.sentido)
    : filtradas;

  return (
    <section className="flex flex-col gap-2">
      {tabela.titulo && (
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          {tabela.titulo}
          <span className="rounded-full bg-neutral-900/[0.06] px-2 py-0.5 text-xs font-medium text-neutral-600">
            {filtradas.length}
          </span>
        </h3>
      )}
      {linhas.length === 0 ? (
        <p className="rounded-2xl bg-neutral-900/[0.03] px-4 py-6 text-center text-sm text-neutral-500">
          {termo
            ? "Ninguém com esse nome."
            : (tabela.vazio ?? "Nenhum registro.")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-900/[0.06] bg-white/50">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-900/[0.08] text-xs text-neutral-500">
                {tabela.colunas.map((c, k) => {
                  const ativa = ordem?.coluna === k;
                  return (
                    <th
                      key={c.titulo}
                      scope="col"
                      aria-sort={
                        ativa
                          ? ordem?.sentido === 1
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                      className={`px-3 py-2.5 font-medium ${c.numero ? "text-right" : "text-left"}`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOrdem((o) =>
                            o?.coluna === k
                              ? { coluna: k, sentido: o.sentido === 1 ? -1 : 1 }
                              : { coluna: k, sentido: c.numero ? -1 : 1 },
                          )
                        }
                        className={`inline-flex items-center gap-1 rounded-md transition hover:text-neutral-900 ${ativa ? "text-neutral-900" : ""}`}
                      >
                        {c.titulo}
                        {ativa &&
                          (ordem?.sentido === 1 ? (
                            <ArrowUp className="size-3" aria-hidden />
                          ) : (
                            <ArrowDown className="size-3" aria-hidden />
                          ))}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr
                  key={l.chave}
                  className="border-b border-neutral-900/[0.05] transition-colors last:border-0 hover:bg-white/70"
                >
                  {tabela.colunas.map((c, k) => (
                    <td
                      key={c.titulo}
                      className={`px-3 py-2 ${c.numero ? "text-right tabular-nums" : ""}`}
                    >
                      {c.pessoa ? (
                        <span className="flex items-center gap-2.5">
                          <span
                            aria-hidden
                            className="grid size-7 shrink-0 place-items-center rounded-full bg-violet-100 text-[10px] font-semibold text-violet-700"
                          >
                            {iniciais(l.celulas[k] ?? "")}
                          </span>
                          <span className="font-medium">{l.celulas[k]}</span>
                        </span>
                      ) : (
                        l.celulas[k]
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * Tabelas do detalhe aberto: as que vieram prontas ou, com carregarTabelas,
 * as do pedido ao servidor (modal-detalhe.tsx), que em geral já começou na
 * pré-carga e às vezes já chegou: aí aparecem direto, sem esqueleto. null
 * enquanto o pedido não volta.
 */
function useTabelasDo(detalhe: Detalhe | null): {
  lista: TabelaDetalhe[] | null;
  erro: boolean;
} {
  const [, redesenhar] = useReducer((n: number) => n + 1, 0);
  const pedido = pedidoDe(detalhe);

  useEffect(() => {
    if (!detalhe?.carregarTabelas) return;
    // Aberto sem pedido (ou o anterior falhou e o modal reabriu): pede.
    const atual = pedido ?? pedirTabelas(detalhe);
    if (!atual) return;
    let vivo = true;
    const chegou = () => {
      if (vivo) redesenhar();
    };
    atual.promessa.then(chegou, chegou);
    return () => {
      vivo = false;
    };
  }, [detalhe, pedido]);

  if (!detalhe) return { lista: [], erro: false };
  if (!detalhe.carregarTabelas) return { lista: detalhe.tabelas, erro: false };
  return { lista: pedido?.lista ?? null, erro: pedido?.erro ?? false };
}

export function ModalDetalhe({
  detalhe,
  aoFechar,
}: {
  detalhe: Detalhe | null;
  aoFechar: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [busca, setBusca] = useState("");
  // Guarda o último conteúdo para a animação de saída não piscar vazia.
  const [visivel, setVisivel] = useState<Detalhe | null>(null);
  const tabelas = useTabelasDo(visivel);

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (detalhe) {
      setVisivel(detalhe);
      setBusca("");
      if (!d.open) d.showModal();
      document.documentElement.style.overflow = "hidden";
    } else if (d.open) {
      d.close();
    }
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [detalhe]);

  const total = tabelas.lista?.reduce((s, t) => s + t.linhas.length, 0) ?? 0;

  return (
    <dialog
      ref={dialogo}
      aria-labelledby="modal-detalhe-titulo"
      onClose={() => {
        document.documentElement.style.overflow = "";
        aoFechar();
      }}
      // Clicar fora do painel (no fundo) fecha.
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      // Teclado: Esc já fecha (comportamento nativo do <dialog>).
      onKeyDown={() => undefined}
      className="modal-detalhe m-auto max-h-[min(88dvh,52rem)] w-[min(60rem,calc(100vw-1.5rem))] overflow-hidden rounded-[2rem] border-0 bg-transparent p-0 text-neutral-900 backdrop:bg-black/45 backdrop:backdrop-blur-md"
    >
      {visivel && (
        <div className="painel-modal flex max-h-[min(88dvh,52rem)] flex-col rounded-[2rem]">
          {/* Sem overflow-hidden: o balão de fontes desce sobre a tabela (o
              <dialog> já recorta o brilho nos cantos). */}
          <header className="relative isolate z-10 shrink-0 px-6 pt-6 pb-4 md:px-8 md:pt-8">
            <div
              aria-hidden
              className="absolute -top-20 right-10 -z-10 h-40 w-1/2 rounded-full bg-marca/25 blur-3xl"
            />
            {visivel.secao && (
              <p className="text-[11px] font-semibold tracking-[0.2em] text-marca-escuro uppercase">
                {visivel.secao}
              </p>
            )}
            <div className="mt-1 flex items-center gap-2 pr-12">
              <h2
                id="modal-detalhe-titulo"
                className="text-2xl font-semibold tracking-tight md:text-3xl"
              >
                {visivel.titulo}
              </h2>
              {visivel.fontes && visivel.fontes.length > 0 && (
                <InfoFontes fontes={visivel.fontes} />
              )}
            </div>
            {visivel.subtitulo && (
              <p className="mt-1 text-sm text-neutral-500">
                {visivel.subtitulo}
              </p>
            )}
            <button
              type="button"
              onClick={() => dialogo.current?.close()}
              aria-label="Fechar"
              className="absolute top-5 right-5 grid size-10 place-items-center rounded-full bg-neutral-900 text-white transition hover:scale-105 md:top-7 md:right-7"
            >
              <X className="size-4" aria-hidden />
            </button>

            {visivel.resumo && visivel.resumo.length > 0 && (
              <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {visivel.resumo.map((r) => (
                  <div
                    key={r.rotulo}
                    className="rounded-2xl bg-neutral-900/[0.04] px-4 py-3"
                  >
                    <dt className="text-[11px] text-neutral-500">{r.rotulo}</dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums">
                      {r.valor}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            {total > 6 && (
              <label className="mt-4 flex items-center gap-2 rounded-full border border-neutral-900/10 bg-white/70 py-1.5 pr-4 pl-1.5 text-sm">
                <span className="grid size-7 place-items-center rounded-full bg-neutral-900 text-white">
                  <Search className="size-3.5" aria-hidden />
                </span>
                <span className="sr-only">Buscar pessoa</span>
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar pelo nome ou setor…"
                  className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-neutral-400"
                />
              </label>
            )}
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pb-6 md:px-8">
            {tabelas.erro ? (
              <p className="rounded-2xl bg-neutral-900/[0.03] px-4 py-6 text-center text-sm text-neutral-500">
                Não foi possível carregar a lista. Feche e abra de novo.
              </p>
            ) : tabelas.lista === null ? (
              <output className="flex flex-col gap-3">
                <span className="sr-only">Carregando a lista…</span>
                <span aria-hidden className="carregando h-24 rounded-2xl" />
                <span aria-hidden className="carregando h-48 rounded-2xl" />
              </output>
            ) : (
              tabelas.lista.map((t, k) => (
                <Tabela
                  key={`${visivel.titulo}-${k}`}
                  tabela={t}
                  busca={busca}
                />
              ))
            )}
          </div>

          {visivel.link && (
            <footer className="flex justify-end border-t border-neutral-900/[0.06] px-6 py-4 md:px-8">
              <Link
                href={visivel.link.href}
                className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800"
              >
                {visivel.link.rotulo}
                <ArrowUpRight className="size-4" aria-hidden />
              </Link>
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}

/**
 * "i" discreto ao lado do título: ao passar o mouse (ou focar pelo teclado),
 * mostra de onde vem o número (fonte, fórmula, atualização).
 */
function InfoFontes({ fontes }: { fontes: NonNullable<Detalhe["fontes"]> }) {
  const id = useId();
  return (
    <span className="group/info relative inline-flex">
      <button
        type="button"
        aria-label="De onde vêm os dados"
        aria-describedby={id}
        className="grid size-6 place-items-center rounded-full text-neutral-400 ring-1 ring-neutral-900/10 transition hover:bg-neutral-900 hover:text-white hover:ring-neutral-900 focus-visible:bg-neutral-900 focus-visible:text-white focus-visible:outline-none"
      >
        <Info className="size-3.5" aria-hidden />
      </button>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none invisible absolute top-full left-1/2 z-20 mt-2 w-[min(24rem,calc(100vw-3rem))] -translate-x-1/2 translate-y-1 rounded-2xl bg-neutral-900/95 p-4 text-left text-xs text-white opacity-0 shadow-[0_20px_40px_-16px_rgb(0_0_0/0.5)] ring-1 ring-white/10 backdrop-blur-md transition duration-150 group-focus-within/info:visible group-focus-within/info:translate-y-0 group-focus-within/info:opacity-100 group-hover/info:visible group-hover/info:translate-y-0 group-hover/info:opacity-100 sm:left-0 sm:translate-x-0"
      >
        <span className="block text-[10px] font-semibold tracking-[0.14em] text-white/50 uppercase">
          De onde vêm os dados
        </span>
        <span className="mt-2 flex flex-col gap-1.5">
          {fontes.map((f) => (
            <span key={f.rotulo} className="block leading-snug">
              <span className="text-white/55">{f.rotulo}: </span>
              {f.valor}
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}
