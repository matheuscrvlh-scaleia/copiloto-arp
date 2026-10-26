"use client";

import { Printer, Timer, Wrench } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SeloExemplo, SeloStatusChamado } from "@/components/os/selos";
import { formatarMoeda, formatarNumero } from "@/lib/formato";
import { formatarDuracao } from "@/lib/os/calculos";
import { MAXIMO_LOTE_PDF, rotaPdfOS } from "@/lib/os/ordem";
import type { LinhaOSTela } from "@/lib/os/tabela-ordens";

// Lista das OS: tabela no computador (a partir de xl, cabendo na largura,
// sem rolagem lateral) e cartões no tablet e no celular. Marcar várias
// imprime o lote (uma OS por folha); clicar abre o detalhe ao lado.
// Na tabela, os períodos vão embaixo do título, os técnicos aparecem
// abreviados (o nome inteiro fica na dica) e, abaixo de 2xl, duração com
// H.H. e valor com rateio dividem a mesma coluna.

export type { LinhaOSTela } from "@/lib/os/tabela-ordens";

/** "Ana Souza, Bruno Lima, Caio" → "Ana" e mais 2 (terceirizada: a empresa). */
function abreviarTecnicos(l: LinhaOSTela): { curto: string; mais: number } {
  const nomes = l.tecnicos
    .split(", ")
    .map((n) => n.trim())
    .filter(Boolean);
  const [primeiro, ...resto] = nomes;
  if (!primeiro) return { curto: "—", mais: 0 };
  const curto =
    l.execucao === "terceirizada" ? primeiro : (primeiro.split(" ")[0] ?? "");
  return { curto, mais: resto.length };
}

function Tecnicos({ l }: { l: LinhaOSTela }) {
  const { curto, mais } = abreviarTecnicos(l);
  return (
    <span
      className="inline-flex max-w-32 items-center gap-1.5 2xl:max-w-36"
      title={l.tecnicos || undefined}
    >
      <span className="truncate">{curto}</span>
      {mais > 0 && (
        <span className="shrink-0 rounded-full bg-neutral-900/[0.06] px-1.5 py-px text-[11px] font-medium text-neutral-600 tabular-nums">
          +{mais}
        </span>
      )}
      {mais > 0 && <span className="sr-only">: {l.tecnicos}</span>}
    </span>
  );
}

/** Períodos de trabalho, um por pedaço, quebrando entre eles. */
function Periodos({ texto }: { texto: string }) {
  const partes = texto.split(" | ").filter(Boolean);
  if (partes.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-neutral-500 tabular-nums">
      {partes.map((p) => (
        <span key={p} className="whitespace-nowrap">
          {p}
        </span>
      ))}
    </span>
  );
}

const NUM = "px-2 py-2 text-right whitespace-nowrap tabular-nums";
/** Só abaixo de 2xl (colunas juntas) / só em 2xl (colunas separadas). */
const JUNTAS = "2xl:hidden";
const SEPARADAS = "hidden 2xl:table-cell";

export function ListaOrdens({
  linhas,
  total,
  comCustos,
  acoes,
  paginacao,
}: {
  /** As OS desta página. */
  linhas: LinhaOSTela[];
  /** Quantas OS o filtro tem (todas as páginas). */
  total: number;
  comCustos: boolean;
  /** Botões do topo (exportar). */
  acoes?: React.ReactNode;
  /** Navegação entre as páginas (vai no topo e no pé). */
  paginacao?: React.ReactNode;
}) {
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [comFotos, setComFotos] = useState(true);
  const selecionadas = linhas.filter((l) => marcadas.has(l.id));
  const todas = linhas.length > 0 && selecionadas.length === linhas.length;

  function alternar(id: string) {
    setMarcadas((m) => {
      const n = new Set(m);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  const marcarTodas = () =>
    setMarcadas(todas ? new Set() : new Set(linhas.map((l) => l.id)));

  const totais = useMemo(
    () => ({
      minutos: linhas.reduce((t, l) => t + l.minutos, 0),
      mh: linhas.reduce((t, l) => t + l.minutoHomem, 0),
      valor: linhas.reduce((t, l) => t + (l.valor ?? 0), 0),
      rateio: linhas.reduce((t, l) => t + (l.valorRateio ?? 0), 0),
    }),
    [linhas],
  );

  return (
    <section
      aria-label="Ordens de serviço"
      className="vidro flex min-w-0 flex-col gap-4 rounded-[1.75rem] p-4 md:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-600">
          <span className="font-semibold text-neutral-900 tabular-nums">
            {formatarNumero(total)}
          </span>{" "}
          OS
          {selecionadas.length > 0 &&
            ` · ${selecionadas.length} ${selecionadas.length === 1 ? "marcada" : "marcadas"}`}
        </p>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {selecionadas.length > MAXIMO_LOTE_PDF && (
            <p role="alert" className="text-xs text-red-700">
              Imprima no máximo {MAXIMO_LOTE_PDF} OS por vez.
            </p>
          )}
          {selecionadas.length > 0 &&
            selecionadas.length <= MAXIMO_LOTE_PDF && (
              <>
                <label className="flex items-center gap-1.5 text-xs text-neutral-600">
                  <input
                    type="checkbox"
                    checked={comFotos}
                    onChange={(e) => setComFotos(e.target.checked)}
                    className="size-4 accent-neutral-900"
                  />
                  Com fotos
                </label>
                <a
                  href={rotaPdfOS(
                    selecionadas.map((l) => l.id),
                    comFotos,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
                >
                  <Printer className="size-4" aria-hidden />
                  Imprimir{" "}
                  {selecionadas.length === 1
                    ? "a OS"
                    : `${selecionadas.length} OS`}
                </a>
              </>
            )}
          {acoes}
        </div>
      </div>

      {total > linhas.length && paginacao}

      {linhas.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-500">
          Nenhuma OS com esses filtros.
        </p>
      ) : (
        <>
          {/* Celular e tablet: cartões (duas colunas a partir de lg). */}
          <div className="flex flex-col gap-3 xl:hidden">
            <label className="flex w-fit items-center gap-2 px-1 text-xs text-neutral-600">
              <input
                type="checkbox"
                checked={todas}
                onChange={marcarTodas}
                className="size-4 accent-neutral-900"
              />
              Marcar todas para imprimir
            </label>
            <ul className="grid gap-2 lg:grid-cols-2">
              {linhas.map((l) => (
                <li
                  key={l.id}
                  className="flex min-w-0 gap-3 rounded-2xl bg-white/60 p-3 ring-1 ring-neutral-900/[0.06]"
                >
                  <input
                    type="checkbox"
                    checked={marcadas.has(l.id)}
                    onChange={() => alternar(l.id)}
                    aria-label={`Marcar a OS ${l.numero} para imprimir`}
                    className="mt-1 size-4 shrink-0 accent-neutral-900"
                  />
                  <Link href={l.href} scroll={false} className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
                      <span className="font-semibold text-neutral-900 tabular-nums">
                        Nº {l.numero}
                      </span>
                      {l.tipoServico}
                      {l.rodando && <Rodando />}
                      {l.exemplo && <SeloExemplo />}
                    </span>
                    <span className="mt-0.5 block font-medium break-words">
                      {l.titulo}
                    </span>
                    <span className="block truncate text-xs text-neutral-500">
                      {[l.local, l.tecnicos].filter(Boolean).join(" · ")}
                    </span>
                    <span className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <SeloStatusChamado
                        status={l.status}
                        aguardando={l.aguardando}
                      />
                      <span className="tabular-nums text-neutral-600">
                        {l.duracao} · H.H. {l.hh}
                      </span>
                      {comCustos && (
                        <span className="font-medium tabular-nums">
                          {formatarMoeda(l.valor)}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Computador: tabela que cabe na largura do quadro. */}
          <div className="-mx-2 hidden overflow-x-auto xl:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs whitespace-nowrap text-neutral-500">
                  <th className="w-8 px-2 py-2">
                    <input
                      type="checkbox"
                      checked={todas}
                      onChange={marcarTodas}
                      aria-label="Marcar todas para imprimir"
                      className="size-4 accent-neutral-900"
                    />
                  </th>
                  <th className="px-2 py-2 font-medium">Nº</th>
                  <th className="w-full px-2 py-2 font-medium">
                    Título e períodos
                  </th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Local</th>
                  <th className="px-2 py-2 font-medium">Técnicos</th>
                  <th className={`${NUM} font-medium ${JUNTAS}`}>
                    Duração
                    <span className="block font-normal">H.H.</span>
                  </th>
                  <th className={`${NUM} font-medium ${SEPARADAS}`}>Duração</th>
                  <th className={`${NUM} font-medium ${SEPARADAS}`}>H.H.</th>
                  {comCustos && (
                    <>
                      <th className={`${NUM} font-medium ${JUNTAS}`}>
                        Valor
                        <span className="block font-normal">com rateio</span>
                      </th>
                      <th className={`${NUM} font-medium ${SEPARADAS}`}>
                        Valor
                      </th>
                      <th className={`${NUM} font-medium ${SEPARADAS}`}>
                        Com rateio
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr
                    key={l.id}
                    className="border-b border-neutral-900/[0.06] align-top transition-colors last:border-0 hover:bg-white/50"
                  >
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={marcadas.has(l.id)}
                        onChange={() => alternar(l.id)}
                        aria-label={`Marcar a OS ${l.numero} para imprimir`}
                        className="size-4 accent-neutral-900"
                      />
                    </td>
                    <td className="px-2 py-2 font-semibold whitespace-nowrap tabular-nums">
                      {l.numero}
                    </td>
                    <td className="min-w-52 px-2 py-2">
                      <Link
                        href={l.href}
                        scroll={false}
                        className="font-medium break-words underline-offset-2 hover:underline"
                      >
                        {l.titulo}
                      </Link>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
                        {l.execucao === "terceirizada" ? (
                          "Terceirizada"
                        ) : (
                          <>
                            <Wrench className="size-3" aria-hidden />
                            {l.tipoServico}
                          </>
                        )}
                        {l.rodando && <Rodando />}
                        {l.exemplo && <SeloExemplo />}
                      </span>
                      <span className="mt-1 block">
                        <Periodos texto={l.periodos} />
                      </span>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <SeloStatusChamado
                        status={l.status}
                        aguardando={l.aguardando}
                      />
                    </td>
                    <td className="px-2 py-2 text-neutral-700">
                      <span
                        className="block max-w-32 truncate 2xl:max-w-44"
                        title={l.local || undefined}
                      >
                        {l.local || "—"}
                      </span>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-neutral-700">
                      <Tecnicos l={l} />
                    </td>
                    <td className={`${NUM} ${JUNTAS}`}>
                      {l.duracao}
                      <span className="block text-xs text-neutral-500">
                        H.H. {l.hh}
                      </span>
                    </td>
                    <td className={`${NUM} ${SEPARADAS}`}>{l.duracao}</td>
                    <td className={`${NUM} ${SEPARADAS}`}>{l.hh}</td>
                    {comCustos && (
                      <>
                        <td className={`${NUM} ${JUNTAS}`}>
                          {formatarMoeda(l.valor)}
                          <span className="block text-xs text-neutral-500">
                            {l.rateio
                              ? formatarMoeda(l.valorRateio)
                              : "sem rateio"}
                          </span>
                        </td>
                        <td className={`${NUM} ${SEPARADAS}`}>
                          {formatarMoeda(l.valor)}
                        </td>
                        <td className={`${NUM} ${SEPARADAS}`}>
                          {l.rateio ? formatarMoeda(l.valorRateio) : "—"}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-neutral-300 align-top font-semibold">
                  <td className="px-2 py-2" colSpan={6}>
                    {/* Somar o filtro inteiro pediria todas as sessões: a soma é da página. */}
                    {total > linhas.length ? "Total nesta página" : "Total"}
                  </td>
                  <td className={`${NUM} ${JUNTAS}`}>
                    {formatarDuracao(totais.minutos)}
                    <span className="block text-xs font-medium text-neutral-500">
                      H.H. {formatarDuracao(totais.mh)}
                    </span>
                  </td>
                  <td className={`${NUM} ${SEPARADAS}`}>
                    {formatarDuracao(totais.minutos)}
                  </td>
                  <td className={`${NUM} ${SEPARADAS}`}>
                    {formatarDuracao(totais.mh)}
                  </td>
                  {comCustos && (
                    <>
                      <td className={`${NUM} ${JUNTAS}`}>
                        {formatarMoeda(totais.valor)}
                        <span className="block text-xs font-medium text-neutral-500">
                          {formatarMoeda(totais.rateio)}
                        </span>
                      </td>
                      <td className={`${NUM} ${SEPARADAS}`}>
                        {formatarMoeda(totais.valor)}
                      </td>
                      <td className={`${NUM} ${SEPARADAS}`}>
                        {formatarMoeda(totais.rateio)}
                      </td>
                    </>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
      {paginacao}
    </section>
  );
}

function Rodando() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-green-700">
      <Timer className="size-3" aria-hidden />
      em execução
    </span>
  );
}
