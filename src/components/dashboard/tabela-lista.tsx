"use client";

import { ArrowDown, ArrowUp, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { type Detalhe, useAbrirDetalhe } from "@/components/modal-detalhe";

// Lista do padrão das telas de consulta (spec 4.3): busca por texto, ordenação
// clicando na coluna, total no rodapé, subtotal por grupo que a pessoa liga
// e desliga, e clicar na linha abre o detalhe (página ou modal). A tabela
// larga rola dentro do quadro, nunca a página. As células chegam prontas do
// servidor; `ordem` traz o valor cru de cada coluna para ordenar.

export interface ColunaLista {
  titulo: string;
  numero?: boolean;
  /** Dica no cabeçalho (ex.: "não informado pela plataforma"). */
  dica?: string;
  /** Classe do cabeçalho e das células (ex.: largura mínima). */
  classe?: string;
}

export interface LinhaLista {
  chave: string;
  celulas: React.ReactNode[];
  /** Valor para ordenar, coluna a coluna (null vai para o fim). */
  ordem: (number | string | null)[];
  /** Texto em que a busca procura. */
  busca: string;
  /** Grupo da linha para o subtotal (ex.: plataforma). */
  grupo?: string;
  /** Página do detalhe… */
  href?: string;
  /** …ou o modal de detalhe. */
  detalhe?: Detalhe;
  /** Destaque (ex.: linha em alerta). */
  tom?: "alerta" | "atencao";
}

const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function TabelaLista({
  colunas,
  linhas,
  rodape,
  subtotais,
  rotuloGrupo,
  ordemInicial,
  vazio = "Nenhum registro no período.",
  placeholder = "Buscar na lista…",
  semBusca = false,
  alturaMax,
  caber = false,
}: {
  colunas: ColunaLista[];
  linhas: LinhaLista[];
  /** Total de todas as linhas (não muda com a busca: é o total do período). */
  rodape?: React.ReactNode[];
  /** Subtotal de cada grupo, pela chave do grupo. */
  subtotais?: Record<string, { rotulo: string; celulas: React.ReactNode[] }>;
  /** Texto do botão que liga o subtotal (ex.: "Subtotal por plataforma"). */
  rotuloGrupo?: string;
  ordemInicial?: { coluna: number; desc: boolean };
  vazio?: string;
  placeholder?: string;
  semBusca?: boolean;
  /** Altura máxima com rolagem vertical (ex.: "max-h-[32rem]"). */
  alturaMax?: string;
  /** Cabe na largura do quadro (sem rolagem lateral): os textos quebram. */
  caber?: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [ordem, setOrdem] = useState(ordemInicial ?? null);
  const [agrupar, setAgrupar] = useState(false);
  const abrir = useAbrirDetalhe();
  const router = useRouter();

  const visiveis = useMemo(() => {
    const t = sem(texto.trim());
    const filtradas = t
      ? linhas.filter((l) => sem(l.busca).includes(t))
      : linhas;
    if (!ordem) return filtradas;
    const { coluna, desc } = ordem;
    return [...filtradas].sort((a, b) => {
      const x = a.ordem[coluna] ?? null;
      const y = b.ordem[coluna] ?? null;
      if (x === y) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      const c =
        typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x).localeCompare(String(y), "pt-BR");
      return desc ? -c : c;
    });
  }, [linhas, texto, ordem]);

  const grupos = useMemo(() => {
    if (!agrupar || !subtotais) return null;
    const mapa = new Map<string, LinhaLista[]>();
    for (const l of visiveis) {
      const g = l.grupo ?? "";
      mapa.set(g, [...(mapa.get(g) ?? []), l]);
    }
    return [...mapa.entries()];
  }, [agrupar, subtotais, visiveis]);

  function ordenar(i: number) {
    setOrdem((o) =>
      o?.coluna === i
        ? { coluna: i, desc: !o.desc }
        : { coluna: i, desc: !!colunas[i]?.numero },
    );
  }

  const alinhar = (c?: ColunaLista) =>
    `${c?.numero ? "text-right tabular-nums whitespace-nowrap" : "text-left"} ${c?.classe ?? ""}`;

  const linha = (l: LinhaLista) => {
    const clicavel = Boolean(l.href || (l.detalhe && abrir));
    const conteudo = l.celulas.map((c, i) => (
      <td
        // biome-ignore lint/suspicious/noArrayIndexKey: a posição é a coluna
        key={i}
        className={`px-2 py-2.5 ${alinhar(colunas[i])}`}
      >
        {c}
      </td>
    ));
    return (
      <tr
        key={l.chave}
        onClick={
          l.href
            ? () => router.push(l.href as string)
            : l.detalhe && abrir
              ? () => abrir(l.detalhe as Detalhe)
              : undefined
        }
        className={`group border-b border-neutral-900/[0.06] transition-colors last:border-0 hover:bg-white/60 ${clicavel ? "cursor-pointer" : ""} ${l.tom === "alerta" ? "bg-red-500/[0.06]" : l.tom === "atencao" ? "bg-amber-400/[0.08]" : ""}`}
      >
        {conteudo}
        <td className="w-6 pr-2 text-right">
          {l.href ? (
            <Link
              href={l.href}
              aria-label="Abrir o detalhe"
              className="inline-grid size-6 place-items-center rounded-full text-neutral-400 transition group-hover:bg-neutral-900 group-hover:text-white"
            >
              <ChevronRight className="size-3.5" aria-hidden />
            </Link>
          ) : clicavel ? (
            <ChevronRight
              className="ml-auto size-3.5 text-neutral-300 group-hover:text-neutral-700"
              aria-hidden
            />
          ) : null}
        </td>
      </tr>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {(!semBusca || (subtotais && rotuloGrupo)) && (
        <div className="flex flex-wrap items-center gap-2">
          {!semBusca && (
            <label
              data-guia="busca"
              className="flex min-w-48 flex-1 items-center gap-2 rounded-full border border-neutral-200 bg-white/70 px-3 py-1.5 sm:max-w-xs"
            >
              <Search className="size-4 text-neutral-400" aria-hidden />
              <input
                type="search"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={placeholder}
                aria-label={placeholder}
                className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
              />
            </label>
          )}
          {subtotais && rotuloGrupo && (
            <button
              type="button"
              aria-pressed={agrupar}
              onClick={() => setAgrupar((a) => !a)}
              className="rounded-full border border-neutral-200 bg-white/70 px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:border-neutral-400 aria-pressed:border-neutral-900 aria-pressed:bg-neutral-900 aria-pressed:text-white"
            >
              {rotuloGrupo}
            </button>
          )}
          {texto && (
            <span className="text-xs text-neutral-500">
              {visiveis.length} de {linhas.length}
            </span>
          )}
        </div>
      )}
      <div className={`-mx-2 overflow-auto ${alturaMax ?? ""}`}>
        {visiveis.length === 0 ? (
          <p className="px-2 py-6 text-sm text-neutral-500">
            {texto ? "Nada encontrado na busca." : vazio}
          </p>
        ) : (
          <table
            className={`relative w-full border-collapse text-sm ${caber ? "" : "min-w-max"}`}
          >
            <thead className="sticky top-0 z-10 bg-white/85 backdrop-blur">
              <tr className="border-b border-neutral-200 text-xs text-neutral-500">
                {colunas.map((c, i) => (
                  <th
                    key={c.titulo}
                    className={`px-2 py-2 font-medium ${alinhar(c)}`}
                    aria-sort={
                      ordem?.coluna === i
                        ? ordem.desc
                          ? "descending"
                          : "ascending"
                        : undefined
                    }
                  >
                    <button
                      type="button"
                      onClick={() => ordenar(i)}
                      title={c.dica}
                      className={`inline-flex items-center gap-1 rounded hover:text-neutral-900 ${c.numero ? "flex-row-reverse" : ""}`}
                    >
                      {c.titulo}
                      {c.dica && <span aria-hidden>*</span>}
                      {ordem?.coluna === i &&
                        (ordem.desc ? (
                          <ArrowDown className="size-3" aria-hidden />
                        ) : (
                          <ArrowUp className="size-3" aria-hidden />
                        ))}
                    </button>
                  </th>
                ))}
                <th className="w-6" aria-label="Detalhe" />
              </tr>
            </thead>
            <tbody>
              {grupos
                ? grupos.map(([g, ls]) => (
                    <Fragment key={g}>
                      {ls.map(linha)}
                      {subtotais?.[g] && (
                        <tr className="border-b border-neutral-300 bg-neutral-900/[0.03] font-medium">
                          {(subtotais[g]?.celulas ?? []).map((c, i) => (
                            <td
                              // biome-ignore lint/suspicious/noArrayIndexKey: a posição é a coluna
                              key={i}
                              className={`px-2 py-2 ${alinhar(colunas[i])}`}
                            >
                              {i === 0
                                ? `Subtotal ${subtotais[g]?.rotulo ?? ""}`
                                : c}
                            </td>
                          ))}
                          <td />
                        </tr>
                      )}
                    </Fragment>
                  ))
                : visiveis.map(linha)}
            </tbody>
            {rodape && (
              <tfoot className="sticky bottom-0 bg-white/85 backdrop-blur">
                <tr className="border-t border-neutral-300 font-semibold">
                  {rodape.map((v, i) => (
                    <td
                      // biome-ignore lint/suspicious/noArrayIndexKey: a posição é a coluna
                      key={i}
                      className={`px-2 py-2 ${alinhar(colunas[i])}`}
                    >
                      {v}
                    </td>
                  ))}
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </div>
  );
}
