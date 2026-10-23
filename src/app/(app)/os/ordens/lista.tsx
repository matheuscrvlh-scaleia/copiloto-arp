"use client";

import { Printer, Timer, Wrench } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SeloExemplo, SeloStatusChamado } from "@/components/os/selos";
import { formatarMoeda, formatarNumero } from "@/lib/formato";
import { formatarDuracao } from "@/lib/os/calculos";
import { MAXIMO_LOTE_PDF, rotaPdfOS } from "@/lib/os/ordem";
import type { LinhaOSTela } from "./tabela";

// Lista das OS: tabela no computador, cartões no celular. Marcar várias
// imprime o lote (uma OS por folha); clicar abre o detalhe ao lado.

export type { LinhaOSTela } from "./tabela";

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
      className="vidro flex flex-col gap-4 rounded-[1.75rem] p-4 md:p-6"
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
        <div className="flex flex-wrap items-center gap-2">
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
          {/* Celular: cartões empilhados. */}
          <ul className="flex flex-col gap-2 md:hidden">
            {linhas.map((l) => (
              <li
                key={l.id}
                className="flex gap-3 rounded-2xl bg-white/60 p-3 ring-1 ring-neutral-900/[0.06]"
              >
                <input
                  type="checkbox"
                  checked={marcadas.has(l.id)}
                  onChange={() => alternar(l.id)}
                  aria-label={`Marcar a OS ${l.numero} para imprimir`}
                  className="mt-1 size-4 shrink-0 accent-neutral-900"
                />
                <Link href={l.href} scroll={false} className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-xs text-neutral-500">
                    <span className="font-semibold text-neutral-900 tabular-nums">
                      Nº {l.numero}
                    </span>
                    {l.tipoServico}
                    {l.rodando && <Rodando />}
                  </span>
                  <span className="mt-0.5 block font-medium">{l.titulo}</span>
                  <span className="block truncate text-xs text-neutral-500">
                    {l.local}
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

          {/* Computador: tabela que rola dentro do quadro. */}
          <div className="-mx-2 hidden overflow-x-auto md:block">
            <table className="w-full min-w-max border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                  <th className="w-8 px-2 py-2">
                    <input
                      type="checkbox"
                      checked={todas}
                      onChange={() =>
                        setMarcadas(
                          todas ? new Set() : new Set(linhas.map((l) => l.id)),
                        )
                      }
                      aria-label="Marcar todas para imprimir"
                      className="size-4 accent-neutral-900"
                    />
                  </th>
                  <th className="px-2 py-2 font-medium">Nº</th>
                  <th className="px-2 py-2 font-medium">Título</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Local</th>
                  <th className="px-2 py-2 font-medium">Técnicos</th>
                  <th className="px-2 py-2 font-medium">Períodos</th>
                  <th className="px-2 py-2 text-right font-medium">Duração</th>
                  <th className="px-2 py-2 text-right font-medium">H.H.</th>
                  {comCustos && (
                    <>
                      <th className="px-2 py-2 text-right font-medium">
                        Valor
                      </th>
                      <th className="px-2 py-2 text-right font-medium">
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
                    <td className="px-2 py-2 font-semibold tabular-nums">
                      {l.numero}
                    </td>
                    <td className="max-w-72 px-2 py-2">
                      <Link
                        href={l.href}
                        scroll={false}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {l.titulo}
                      </Link>
                      <span className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
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
                    </td>
                    <td className="px-2 py-2">
                      <SeloStatusChamado
                        status={l.status}
                        aguardando={l.aguardando}
                      />
                    </td>
                    <td className="max-w-56 px-2 py-2 text-neutral-700">
                      {l.local}
                    </td>
                    <td className="max-w-56 px-2 py-2 text-neutral-700">
                      {l.tecnicos || "—"}
                    </td>
                    <td className="max-w-80 px-2 py-2 text-xs text-neutral-500">
                      {l.periodos || "—"}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {l.duracao}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {l.hh}
                    </td>
                    {comCustos && (
                      <>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {formatarMoeda(l.valor)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {l.rateio ? formatarMoeda(l.valorRateio) : "—"}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-neutral-300 font-semibold">
                  <td className="px-2 py-2" colSpan={7}>
                    {/* Somar o filtro inteiro pediria todas as sessões: a soma é da página. */}
                    {total > linhas.length ? "Total nesta página" : "Total"}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatarDuracao(totais.minutos)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatarDuracao(totais.mh)}
                  </td>
                  {comCustos && (
                    <>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {formatarMoeda(totais.valor)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
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
    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
      <Timer className="size-3" aria-hidden />
      em execução
    </span>
  );
}
