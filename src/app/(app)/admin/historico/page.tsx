import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Situacao } from "@/components/admin/ui";
import { FiltrosCarregando } from "@/components/carregando";
import { Carregando, Cartao, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { formatarDataHora, formatarNumero, isoLocal } from "@/lib/formato";
import {
  diferencas,
  type FiltrosHistorico as Filtros,
  type LinhaHistorico,
  lerFiltrosHistorico,
  MODULOS,
  POR_PAGINA,
  rotuloDaAcao,
  rotuloDaTabela,
  urlDaPagina,
} from "@/lib/historico";
import { INTEGRACOES } from "@/lib/integracoes";
import { autoresDoHistorico, historico } from "@/server/admin/historico";
import { FiltrosHistorico } from "./filtros";

export const metadata: Metadata = { title: "Histórico de alterações" };

type Busca = Record<string, string | string[] | undefined>;

export default function Page({ searchParams }: PageProps<"/admin/historico">) {
  return (
    <>
      <PageHeader
        title="Histórico de alterações"
        description="Tudo o que acontece no sistema: quem alterou cada dado (com o antes e o depois), acessos, importações, testes e sincronizações. Abra uma linha para ver o detalhe."
      />
      <Suspense
        fallback={
          <div className="flex flex-col gap-4">
            <FiltrosCarregando />
            <Carregando />
          </div>
        }
      >
        <Protegido permissao="admin.historico">
          <Historico busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

const NOME_SISTEMA: Record<string, string> = Object.fromEntries(
  Object.entries(INTEGRACOES).map(([k, v]) => [k, v.nome]),
);

async function Historico({ busca }: { busca: Promise<Busca> }) {
  const filtros = lerFiltrosHistorico(await busca);
  const [{ linhas, total }, autores] = await Promise.all([
    historico(filtros),
    autoresDoHistorico(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <FiltrosHistorico autores={autores} hoje={isoLocal(new Date())} />
      <Cartao className="p-3 md:p-4">
        {linhas.length === 0 ? (
          <Vazio filtros={filtros} />
        ) : (
          <>
            <div
              className="hidden grid-cols-[9.5rem_10rem_7.5rem_minmax(0,1fr)_9rem_1rem] gap-3 border-b border-neutral-200 px-3 pb-2 text-xs font-medium text-neutral-500 lg:grid"
              aria-hidden
            >
              <span>Quando</span>
              <span>Quem</span>
              <span>Módulo</span>
              <span>O quê</span>
              <span>Ação</span>
              <span />
            </div>
            <ul>
              {linhas.map((l) => (
                <li
                  key={l.id}
                  className="border-b border-neutral-900/[0.06] last:border-0"
                >
                  <Linha l={l} />
                </li>
              ))}
            </ul>
            <Paginacao filtros={filtros} total={total} />
          </>
        )}
      </Cartao>
    </div>
  );
}

function Vazio({ filtros }: { filtros: Filtros }) {
  if (filtros.pagina > 1)
    return (
      <p className="p-3 text-sm text-neutral-500">
        Esta página não existe mais.{" "}
        <Link href={urlDaPagina(filtros, 1)} className="underline">
          Voltar à primeira
        </Link>
        .
      </p>
    );
  const filtrando =
    filtros.busca ||
    filtros.modulo ||
    filtros.tipo ||
    filtros.usuario ||
    filtros.de ||
    filtros.ate;
  return (
    <p className="p-3 text-sm text-neutral-500">
      {filtrando
        ? "Nada encontrado com esses filtros."
        : "Nenhum registro ainda."}
    </p>
  );
}

function quem(l: LinhaHistorico): string {
  if (l.usuarioNome) return l.usuarioNome;
  if (l.usuarioId) return "Usuário excluído";
  if (l.tipo === "evento") return "—";
  return "Sistema";
}

function oQue(l: LinhaHistorico): string {
  if (l.tipo === "alteracao") return rotuloDaTabela(l.objeto ?? "");
  if (l.tipo === "sincronizacao")
    return `${NOME_SISTEMA[l.objeto ?? ""] ?? l.objeto} · ${l.registroId}`;
  return l.descricao ?? "";
}

function Acao({ l }: { l: LinhaHistorico }) {
  const texto = rotuloDaAcao(l);
  if (l.tipo === "sincronizacao")
    return (
      <Situacao
        tipo={
          l.acao === "sucesso" ? "ok" : l.acao === "erro" ? "erro" : "rodando"
        }
      >
        {texto}
      </Situacao>
    );
  if (l.acao === "login_falhou")
    return <Situacao tipo="erro">{texto}</Situacao>;
  return <span className="text-sm">{texto}</span>;
}

function Linha({ l }: { l: LinhaHistorico }) {
  return (
    <details className="group">
      <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 rounded-2xl px-3 py-2.5 text-sm transition hover:bg-white/50 lg:grid-cols-[9.5rem_10rem_7.5rem_minmax(0,1fr)_9rem_1rem] lg:items-center [&::-webkit-details-marker]:hidden">
        <span className="text-xs text-neutral-500 tabular-nums lg:text-sm lg:text-neutral-700">
          {formatarDataHora(l.em)}
        </span>
        <span className="truncate font-medium lg:order-none">{quem(l)}</span>
        <span className="hidden lg:block">
          <span className="rounded-full bg-neutral-900/[0.06] px-2.5 py-1 text-xs text-neutral-700">
            {MODULOS[l.modulo]}
          </span>
        </span>
        <span className="col-span-2 break-words text-neutral-700 lg:col-span-1">
          <span className="text-neutral-400 lg:hidden">
            {MODULOS[l.modulo]} ·{" "}
          </span>
          {oQue(l)}
        </span>
        <span>
          <Acao l={l} />
        </span>
        <ChevronDown
          className="size-4 justify-self-end text-neutral-400 transition group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="px-3 pb-4">
        <Detalhe l={l} />
      </div>
    </details>
  );
}

function Detalhe({ l }: { l: LinhaHistorico }) {
  const origem =
    l.tipo === "alteracao"
      ? `Tabela ${l.objeto} · registro ${l.registroId}`
      : l.tipo === "sincronizacao"
        ? `Execução da sincronização ${l.objeto} (${l.registroId})`
        : `Evento ${l.acao}`;

  // Alteração: o antes e o depois; evento e sincronização: o contexto.
  const linhas =
    l.tipo === "alteracao"
      ? diferencas(l.antes, l.depois)
      : diferencas(null, l.depois);
  const mostrarAntes = l.tipo === "alteracao" && l.acao !== "insert";
  const mostrarDepois = l.tipo !== "alteracao" || l.acao !== "delete";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-neutral-900/[0.06] bg-white/50 p-4">
      <p className="text-xs text-neutral-500">
        {origem}
        {l.tipo === "sincronizacao" && l.descricao && (
          <span className="mt-1 block text-red-700">{l.descricao}</span>
        )}
      </p>
      {linhas.length === 0 ? (
        <p className="text-sm text-neutral-500">Sem detalhes guardados.</p>
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                <th className="px-2 py-1.5 font-medium">Campo</th>
                {mostrarAntes && (
                  <th className="px-2 py-1.5 font-medium">Antes</th>
                )}
                {mostrarDepois && (
                  <th className="px-2 py-1.5 font-medium">
                    {l.tipo === "alteracao" ? "Depois" : "Valor"}
                  </th>
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
                  {mostrarAntes && (
                    <Valor v={d.antes} riscado={mostrarDepois} />
                  )}
                  {mostrarDepois && <Valor v={d.depois} />}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Valor({
  v,
  riscado = false,
}: {
  v: string | null;
  riscado?: boolean;
}) {
  return (
    <td
      className={`max-w-md px-2 py-1.5 break-all ${riscado ? "text-neutral-500" : "text-neutral-900"}`}
    >
      {v === null ? <span className="text-neutral-400">vazio</span> : v}
    </td>
  );
}

function Paginacao({ filtros, total }: { filtros: Filtros; total: number }) {
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const atual = Math.min(filtros.pagina, paginas);
  const inicio = (atual - 1) * POR_PAGINA + 1;
  const fim = Math.min(atual * POR_PAGINA, total);
  const botao =
    "vidro grid size-8 place-items-center rounded-full text-neutral-700 transition hover:border-neutral-400";
  return (
    <nav
      aria-label="Paginação"
      className="mt-3 flex items-center justify-between gap-3 px-3 text-xs text-neutral-500"
    >
      <span className="tabular-nums">
        {formatarNumero(inicio)}–{formatarNumero(fim)} de{" "}
        {formatarNumero(total)}
      </span>
      <div className="flex items-center gap-2">
        {atual > 1 ? (
          <Link
            href={urlDaPagina(filtros, atual - 1)}
            aria-label="Página anterior"
            className={botao}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
        ) : (
          <span className={`${botao} opacity-40`} aria-hidden>
            <ChevronLeft className="size-4" />
          </span>
        )}
        <span className="tabular-nums">
          {atual} / {paginas}
        </span>
        {atual < paginas ? (
          <Link
            href={urlDaPagina(filtros, atual + 1)}
            aria-label="Próxima página"
            className={botao}
          >
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : (
          <span className={`${botao} opacity-40`} aria-hidden>
            <ChevronRight className="size-4" />
          </span>
        )}
      </div>
    </nav>
  );
}
