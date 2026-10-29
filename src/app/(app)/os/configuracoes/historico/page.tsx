import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { LinhaAlteracao } from "@/components/os/configuracoes/alteracoes";
import { FiltrosHistoricoOS } from "@/components/os/configuracoes/filtros-historico";
import { Cartao } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { formatarNumero } from "@/lib/formato";
import {
  type FiltrosHistoricoOS as Filtros,
  lerFiltrosHistoricoOS,
  POR_PAGINA_HISTORICO,
  urlDoHistoricoOS,
} from "@/lib/os/configuracoes";
import { rotaChamado } from "@/lib/os/rotas";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import { pessoas } from "@/server/os/base";
import {
  type Alteracao,
  historicoDoModulo,
  podeVerHistorico,
  TABELAS_OS,
} from "@/server/os/configuracoes";

export const metadata: Metadata = { title: "Histórico de chamados" };

// Quem alterou o quê e quando, em qualquer chamado, cadastro ou parâmetro do
// módulo, com o antes e o depois de cada campo (core.auditoria, liberada
// pelo RLS com os.historico). ?registro=<id> abre já num chamado.

type Busca = Record<string, string | string[] | undefined>;

export default function Page({
  searchParams,
}: PageProps<"/os/configuracoes/historico">) {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <FiltrosCarregando />
          <CartaoCarregando altura="h-[36rem]" />
        </TelaCarregando>
      }
    >
      <Historico busca={searchParams} />
    </Suspense>
  );
}

async function Historico({ busca }: { busca: Promise<Busca> }) {
  if (!(await podeVerHistorico())) return <SemAcesso />;
  const filtros = lerFiltrosHistoricoOS(await busca);
  const [{ linhas, total }, autores] = await Promise.all([
    historicoDoModulo(filtros),
    pessoas(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <FiltrosHistoricoOS
        tabelas={TABELAS_OS}
        autores={autores.map((a) => ({ id: a.id, nome: a.nome }))}
        hoje={hojeEmBrasilia(new Date())}
      />
      <Cartao className="p-3 md:p-4">
        {linhas.length === 0 ? (
          <Vazio filtros={filtros} />
        ) : (
          <>
            <div
              className="hidden grid-cols-[9.5rem_10rem_minmax(0,1fr)_5.5rem_1rem] gap-3 border-b border-neutral-200 px-3 pb-2 text-xs font-medium text-neutral-500 md:grid"
              aria-hidden
            >
              <span>Quando</span>
              <span>Quem</span>
              <span>O quê</span>
              <span>Ação</span>
              <span />
            </div>
            <ul>
              {linhas.map((a) => (
                <li
                  key={a.id}
                  className="border-b border-neutral-900/[0.06] last:border-0"
                >
                  <LinhaAlteracao
                    a={a}
                    extra={<Atalhos a={a} filtros={filtros} />}
                  />
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

/** Abrir o chamado e ver só as alterações daquele registro. */
function Atalhos({ a, filtros }: { a: Alteracao; filtros: Filtros }) {
  const chamado =
    (a.tabela === "os.chamados" || a.tabela === "os.ordens") &&
    a.acao !== "delete";
  const soEste = filtros.registro !== a.registroId;
  if (!chamado && !soEste) return null;
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {chamado && (
        <Link
          href={rotaChamado(a.registroId)}
          className="inline-flex items-center gap-1 font-medium text-neutral-700 hover:underline"
        >
          <ExternalLink className="size-3.5" aria-hidden />
          Abrir o chamado
        </Link>
      )}
      {soEste && (
        <Link
          href={urlDoHistoricoOS(
            { ...filtros, busca: "", tabela: null, registro: a.registroId },
            1,
          )}
          className="text-neutral-500 hover:text-neutral-900 hover:underline"
        >
          Ver todas as alterações deste registro
        </Link>
      )}
    </p>
  );
}

function Vazio({ filtros }: { filtros: Filtros }) {
  if (filtros.pagina > 1)
    return (
      <p className="p-3 text-sm text-neutral-500">
        Esta página não existe mais.{" "}
        <Link href={urlDoHistoricoOS(filtros, 1)} className="underline">
          Voltar à primeira
        </Link>
        .
      </p>
    );
  const filtrando =
    filtros.busca ||
    filtros.tabela ||
    filtros.usuario ||
    filtros.de ||
    filtros.ate ||
    filtros.registro;
  return (
    <p className="p-3 text-sm text-neutral-500">
      {filtrando
        ? "Nada encontrado com esses filtros."
        : "Nenhuma alteração registrada ainda."}
    </p>
  );
}

function Paginacao({ filtros, total }: { filtros: Filtros; total: number }) {
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA_HISTORICO));
  const atual = Math.min(filtros.pagina, paginas);
  const inicio = (atual - 1) * POR_PAGINA_HISTORICO + 1;
  const fim = Math.min(atual * POR_PAGINA_HISTORICO, total);
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
            href={urlDoHistoricoOS(filtros, atual - 1)}
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
            href={urlDoHistoricoOS(filtros, atual + 1)}
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
