"use client";

import { ArrowDown, ArrowUp, ArrowUpRight, Search, X } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { iniciais } from "@/lib/formato";

// Modal padrão do sistema para "quem forma este número": abre ao clicar num
// gráfico ou indicador. Usa <dialog> (Esc fecha, foco preso dentro, fundo
// inerte). Tudo o que ele mostra chega pronto do servidor, já filtrado pelas
// permissões de quem está vendo.

export interface ColunaDetalhe {
  titulo: string;
  /** Alinha à direita e ordena pelo valor numérico. */
  numero?: boolean;
  /** Coluna com o nome da pessoa (ganha as iniciais ao lado). */
  pessoa?: boolean;
}

export interface LinhaDetalhe {
  chave: string;
  celulas: string[];
  /** Valores para ordenar, coluna a coluna (ex.: minutos em vez de "1h30"). */
  ordem?: (number | string | null)[];
}

export interface TabelaDetalhe {
  titulo?: string;
  colunas: ColunaDetalhe[];
  linhas: LinhaDetalhe[];
  vazio?: string;
}

export interface Detalhe {
  /** Texto pequeno acima do título (ex.: "Banco de horas"). */
  secao?: string;
  titulo: string;
  subtitulo?: string;
  resumo?: { rotulo: string; valor: string }[];
  /** De onde vem o número: fonte, fórmula, atualização, parâmetros usados. */
  fontes?: { rotulo: string; valor: string }[];
  tabelas: TabelaDetalhe[];
  link?: { href: string; rotulo: string };
}

// ---------------------------------------------------------------------------
// Um modal por página: os gráficos só pedem para abrir.
// ---------------------------------------------------------------------------

const Contexto = createContext<((d: Detalhe) => void) | null>(null);

/** Função para abrir o modal; null fora do <ProvedorDetalhe>. */
export function useAbrirDetalhe() {
  return useContext(Contexto);
}

export function ProvedorDetalhe({ children }: { children: React.ReactNode }) {
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  return (
    <Contexto.Provider value={setDetalhe}>
      {children}
      <ModalDetalhe detalhe={detalhe} aoFechar={() => setDetalhe(null)} />
    </Contexto.Provider>
  );
}

/**
 * Envolve qualquer bloco (ex.: um cartão de indicador) para abrir o modal
 * ao clicar. Sem permissão (detalhe ausente), vira um bloco comum.
 */
export function AbreDetalhe({
  detalhe,
  className = "",
  children,
}: {
  detalhe?: Detalhe;
  className?: string;
  children: React.ReactNode;
}) {
  const abrir = useAbrirDetalhe();
  if (!detalhe || !abrir) return <div className={className}>{children}</div>;
  return (
    <button
      type="button"
      onClick={() => abrir(detalhe)}
      aria-haspopup="dialog"
      className={`group/detalhe cursor-pointer text-left transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca ${className}`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------

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

  const total = visivel?.tabelas.reduce((s, t) => s + t.linhas.length, 0) ?? 0;

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
          <header className="relative isolate shrink-0 overflow-hidden px-6 pt-6 pb-4 md:px-8 md:pt-8">
            <div
              aria-hidden
              className="absolute -top-20 right-10 -z-10 h-40 w-1/2 rounded-full bg-marca/25 blur-3xl"
            />
            {visivel.secao && (
              <p className="text-[11px] font-semibold tracking-[0.2em] text-marca-escuro uppercase">
                {visivel.secao}
              </p>
            )}
            <h2
              id="modal-detalhe-titulo"
              className="mt-1 pr-12 text-2xl font-semibold tracking-tight md:text-3xl"
            >
              {visivel.titulo}
            </h2>
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
            {visivel.fontes && visivel.fontes.length > 0 && (
              <section className="rounded-2xl border border-neutral-900/[0.08] bg-white/50 px-4 py-3">
                <h3 className="text-[11px] font-semibold tracking-[0.12em] text-neutral-500 uppercase">
                  De onde vêm os dados
                </h3>
                <dl className="mt-2 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[10rem_1fr]">
                  {visivel.fontes.map((f) => (
                    <div key={f.rotulo} className="contents">
                      <dt className="text-neutral-500">{f.rotulo}</dt>
                      <dd className="text-neutral-800">{f.valor}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
            {visivel.tabelas.map((t, k) => (
              <Tabela key={`${visivel.titulo}-${k}`} tabela={t} busca={busca} />
            ))}
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
