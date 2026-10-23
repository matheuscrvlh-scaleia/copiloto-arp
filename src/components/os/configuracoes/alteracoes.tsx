import { ChevronDown, History } from "lucide-react";
import Link from "next/link";
import { CONFIGURACOES_OS } from "@/config/navigation";
import { formatarDataHora } from "@/lib/formato";
import { diferencas, rotuloDaTabela } from "@/lib/historico";
import { nomeDoRegistro } from "@/lib/os/configuracoes";
import type { Alteracao } from "@/server/os/configuracoes";

// Quem mudou, quando, o antes e o depois (core.auditoria). Serve no fim de
// cada bloco de Parâmetros e na aba Histórico.

const ACOES: Record<Alteracao["acao"], string> = {
  insert: "Criou",
  update: "Alterou",
  delete: "Removeu",
};

/** Tabela campo · antes → depois. */
export function Diferencas({ a }: { a: Alteracao }) {
  const linhas = diferencas(a.antes, a.depois);
  const mostrarAntes = a.acao !== "insert";
  const mostrarDepois = a.acao !== "delete";
  if (linhas.length === 0)
    return <p className="text-sm text-neutral-500">Sem detalhes guardados.</p>;
  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
            <th className="px-2 py-1.5 font-medium">Campo</th>
            {mostrarAntes && <th className="px-2 py-1.5 font-medium">Antes</th>}
            {mostrarDepois && (
              <th className="px-2 py-1.5 font-medium">Depois</th>
            )}
          </tr>
        </thead>
        <tbody>
          {linhas.map((d) => (
            <tr
              key={d.campo}
              className="border-b border-neutral-900/[0.06] align-top last:border-0"
            >
              <td className="px-2 py-1.5 font-mono text-xs text-neutral-600">
                {d.campo}
              </td>
              {mostrarAntes && <Valor v={d.antes} apagado={mostrarDepois} />}
              {mostrarDepois && <Valor v={d.depois} />}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Valor({
  v,
  apagado = false,
}: {
  v: string | null;
  apagado?: boolean;
}) {
  return (
    <td
      className={`max-w-md px-2 py-1.5 break-all whitespace-pre-wrap ${apagado ? "text-neutral-500" : "text-neutral-900"}`}
    >
      {v === null ? <span className="text-neutral-400">vazio</span> : v}
    </td>
  );
}

/** Uma alteração que abre para mostrar o detalhe. */
export function LinhaAlteracao({
  a,
  mostrarTabela = true,
  extra,
}: {
  a: Alteracao;
  mostrarTabela?: boolean;
  /** Links junto do detalhe (ex.: abrir o chamado). */
  extra?: React.ReactNode;
}) {
  const nome = nomeDoRegistro(a.antes, a.depois);
  return (
    <details className="group">
      <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 rounded-2xl px-3 py-2.5 text-sm transition hover:bg-white/50 md:grid-cols-[9.5rem_10rem_minmax(0,1fr)_5.5rem_1rem] md:items-center [&::-webkit-details-marker]:hidden">
        <span className="text-xs text-neutral-500 tabular-nums md:text-sm md:text-neutral-700">
          {formatarDataHora(a.em)}
        </span>
        <span className="truncate font-medium md:order-none">{a.autor}</span>
        <span className="col-span-2 min-w-0 break-words text-neutral-700 md:col-span-1">
          {mostrarTabela && (
            <span className="text-neutral-500">
              {rotuloDaTabela(a.tabela)}
              {nome ? " · " : ""}
            </span>
          )}
          {nome ?? (mostrarTabela ? "" : rotuloDaTabela(a.tabela))}
        </span>
        <span className="text-xs text-neutral-600 md:text-sm">
          {ACOES[a.acao]}
        </span>
        <ChevronDown
          className="size-4 justify-self-end text-neutral-400 transition group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="px-3 pb-4">
        <div className="flex flex-col gap-2 rounded-2xl border border-neutral-900/[0.06] bg-white/50 p-3">
          {extra}
          <Diferencas a={a} />
        </div>
      </div>
    </details>
  );
}

/**
 * "Últimas alterações" no fim de um bloco. Sem permissão de histórico
 * (lista null), não mostra nada.
 */
export function UltimasAlteracoes({
  lista,
  tabela,
}: {
  lista: Alteracao[] | null;
  /** Filtro do link "ver tudo" (uma tabela do bloco). */
  tabela?: string;
}) {
  if (lista === null) return null;
  return (
    <div className="mt-2 border-t border-neutral-200/70 pt-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600">
          <History className="size-3.5" aria-hidden />
          Últimas alterações
        </h3>
        <Link
          href={`${CONFIGURACOES_OS.historico}${tabela ? `?tabela=${tabela}` : ""}`}
          className="text-xs text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline"
        >
          Ver tudo no histórico
        </Link>
      </div>
      {lista.length === 0 ? (
        <p className="px-3 py-2 text-xs text-neutral-500">
          Nenhuma alteração registrada ainda.
        </p>
      ) : (
        <ul>
          {lista.map((a) => (
            <li
              key={a.id}
              className="border-b border-neutral-900/[0.06] last:border-0"
            >
              <LinhaAlteracao a={a} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
