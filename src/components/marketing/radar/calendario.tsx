import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List,
  Tag,
  Ticket,
} from "lucide-react";
import Link from "next/link";
import { Legenda } from "@/components/dashboard/graficos/colunas-empilhadas";
import { type CorSerie, corDa } from "@/components/dashboard/graficos/series";
import { SeloStatus } from "@/components/dashboard/indicador";
import { Secao } from "@/components/dashboard/tabela";
import { BarraDeFiltros } from "@/components/marketing/filtros";
import { TabelaMkt } from "@/components/marketing/tabela";
import {
  AbrirNaFerramenta,
  CartaoMkt,
  Cartoes,
  Fonte,
  hrefCom,
  TopoDaTela,
} from "@/components/marketing/tela";
import { BotaoExportar } from "@/components/os/exportar";
import { formatarData, formatarMes, formatarNumero } from "@/lib/formato";
import {
  datasDo,
  diaDaSemana,
  linhaDeFiltros,
  segundaDa,
  somarDias,
} from "@/lib/marketing/periodo";
import {
  COBRANCAS,
  type Cobranca,
  type EventoLinha,
  eventosPorDia,
  fimDoMes,
  TIPOS_EVENTO,
  type TipoEvento,
} from "@/lib/marketing/radar";
import { BASE_RADAR, FONTE_ASANA, type PropsAba, plural, Vazio } from "./comum";

// Aba "Calendário de eventos" (spec 4.9): os eventos dos próximos 6 meses do
// projeto do calendário no Asana, em lista ou em mês. Tipo e cobrança vêm
// das tags cujos nomes estão em Parâmetros.

const COR_TIPO: Record<TipoEvento | "sem", CorSerie> = {
  locatario: 1,
  terceiro: 2,
  sem: "neutro",
};
const SEM_TIPO = "sem_tipo";
const CARTOES: Record<string, string> = {
  proximos30: "Eventos nos próximos 30 dias",
  locatario: "De locatário nos próximos 30 dias",
  terceiro: "De terceiro nos próximos 30 dias",
  paga: "Pagos nos próximos 30 dias",
};
const SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function AbaCalendario({
  p,
  eventos,
  meses,
}: {
  p: PropsAba;
  /** Eventos do 1º dia do mês atual até o fim do 6º mês. */
  eventos: EventoLinha[];
  /** Os 6 meses ("aaaa-mm-01"), do atual em diante. */
  meses: string[];
}) {
  const { hoje } = p;
  const tipo = p.um("tipo");
  const cobranca = p.um("cobranca");
  const cartao = p.um("cartao");
  const visao = p.um("visao") === "mes" ? "mes" : "lista";
  const q = p.um("q").trim().toLowerCase();
  const mesUrl = `${p.um("mes")}-01`;
  const mes = meses.includes(mesUrl) ? mesUrl : (meses[0] as string);
  const ate30 = somarDias(hoje, 29);

  const filtrados = eventos.filter(
    (e) =>
      (!tipo || (tipo === SEM_TIPO ? e.tipo === null : e.tipo === tipo)) &&
      (!cobranca || e.cobranca === cobranca) &&
      (!q || `${e.nome} ${e.responsavel ?? ""}`.toLowerCase().includes(q)),
  );
  const futuros = filtrados.filter((e) => e.fim >= hoje);
  const em30 = futuros.filter((e) => e.inicio <= ate30);
  const lista =
    cartao === "proximos30"
      ? em30
      : cartao === "locatario" || cartao === "terceiro"
        ? em30.filter((e) => e.tipo === cartao)
        : cartao === "paga"
          ? em30.filter((e) => e.cobranca === "paga")
          : futuros;

  const linhaFiltros = linhaDeFiltros([
    {
      rotulo: "Período",
      valor: `Próximos 6 meses (${formatarData(hoje)} a ${formatarData(fimDoMes(meses.at(-1) as string))})`,
    },
    {
      rotulo: "Tipo",
      valor:
        tipo === SEM_TIPO
          ? "Sem tipo"
          : tipo
            ? TIPOS_EVENTO[tipo as TipoEvento]
            : "Todos",
    },
    {
      rotulo: "Gratuita ou paga",
      valor: cobranca ? COBRANCAS[cobranca as Cobranca] : "Todas",
    },
    ...(cartao ? [{ rotulo: "Cartão", valor: CARTOES[cartao] ?? cartao }] : []),
    ...(q ? [{ rotulo: "Busca", valor: p.um("q") }] : []),
  ]);
  const hrefCartao = (k: string) =>
    hrefCom(BASE_RADAR, p.busca, { cartao: cartao === k ? null : k });
  const legenda = [
    {
      chave: "locatario",
      rotulo: TIPOS_EVENTO.locatario,
      cor: COR_TIPO.locatario,
    },
    {
      chave: "terceiro",
      rotulo: TIPOS_EVENTO.terceiro,
      cor: COR_TIPO.terceiro,
    },
    { chave: "sem", rotulo: "Sem tag de tipo", cor: COR_TIPO.sem },
  ];

  return (
    <>
      <BarraDeFiltros
        tela="radar"
        hoje={hoje}
        lembrado={p.lembrado}
        selecoes={[
          {
            chave: "tipo",
            rotulo: "Tipo",
            todos: "Todos os tipos",
            valor: tipo,
            icone: <Tag className="size-4" />,
            opcoes: [
              ...(Object.keys(TIPOS_EVENTO) as TipoEvento[]).map((t) => ({
                valor: t,
                rotulo: TIPOS_EVENTO[t],
              })),
              { valor: SEM_TIPO, rotulo: "Sem tipo" },
            ],
          },
          {
            chave: "cobranca",
            rotulo: "Gratuita ou paga",
            todos: "Gratuitas e pagas",
            valor: cobranca,
            icone: <Ticket className="size-4" />,
            opcoes: (Object.keys(COBRANCAS) as Cobranca[]).map((c) => ({
              valor: c,
              rotulo: COBRANCAS[c],
            })),
          },
        ]}
        busca={{ chave: "q", valor: p.um("q"), placeholder: "Buscar evento…" }}
      />

      <TopoDaTela
        dadosDe={p.dadosDe}
        filtros={linhaFiltros}
        acoes={
          p.exportar ? (
            <BotaoExportar
              titulo="Calendário de eventos"
              filtros={`${linhaFiltros} · ${p.dadosDe}`}
              nomeArquivo="calendario-de-eventos"
              colunas={COLUNAS_EXPORTAR}
              linhas={lista.map((e) => [
                formatarData(e.inicio),
                e.fim !== e.inicio ? formatarData(e.fim) : "",
                e.nome,
                e.tipo ? TIPOS_EVENTO[e.tipo] : "",
                e.cobranca ? COBRANCAS[e.cobranca] : "",
                e.responsavel ?? "",
                e.concluido ? "Concluído" : "Em aberto",
                e.link,
              ])}
            />
          ) : undefined
        }
      />

      <Cartoes>
        <CartaoMkt
          titulo="Eventos nos próximos 30 dias"
          valor={formatarNumero(em30.length)}
          detalhe={`${plural(futuros.length, "evento", "eventos")} nos próximos 6 meses`}
          fonte={FONTE_ASANA}
          href={hrefCartao("proximos30")}
          ativo={cartao === "proximos30"}
        />
        <CartaoMkt
          titulo="De locatário"
          valor={formatarNumero(
            em30.filter((e) => e.tipo === "locatario").length,
          )}
          detalhe="Nos próximos 30 dias"
          fonte={`${FONTE_ASANA} (tag de Parâmetros)`}
          href={hrefCartao("locatario")}
          ativo={cartao === "locatario"}
        />
        <CartaoMkt
          titulo="De terceiro"
          valor={formatarNumero(
            em30.filter((e) => e.tipo === "terceiro").length,
          )}
          detalhe="Nos próximos 30 dias"
          fonte={`${FONTE_ASANA} (tag de Parâmetros)`}
          href={hrefCartao("terceiro")}
          ativo={cartao === "terceiro"}
        />
        <CartaoMkt
          titulo="Pagos"
          valor={formatarNumero(
            em30.filter((e) => e.cobranca === "paga").length,
          )}
          detalhe={`Nos próximos 30 dias · ${em30.filter((e) => e.cobranca === "gratuita").length} gratuitos`}
          fonte={`${FONTE_ASANA} (tag de Parâmetros)`}
          href={hrefCartao("paga")}
          ativo={cartao === "paga"}
        />
      </Cartoes>

      <nav
        aria-label="Visão do calendário"
        className="vidro flex w-fit gap-1 rounded-full p-1"
      >
        {(
          [
            ["lista", "Lista", <List key="i" className="size-4" aria-hidden />],
            [
              "mes",
              "Mês",
              <CalendarDays key="i" className="size-4" aria-hidden />,
            ],
          ] as const
        ).map(([v, rotulo, icone]) => (
          <Link
            key={v}
            href={hrefCom(BASE_RADAR, p.busca, {
              visao: v === "lista" ? null : v,
            })}
            scroll={false}
            aria-current={visao === v ? "page" : undefined}
            className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium text-neutral-600 transition hover:bg-white/60 aria-[current=page]:bg-neutral-900 aria-[current=page]:text-white"
          >
            {icone}
            {rotulo}
          </Link>
        ))}
      </nav>

      {visao === "lista" ? (
        <Secao
          titulo="Eventos"
          descricao="Uma linha por evento do calendário, do mais próximo ao mais distante."
        >
          <TabelaMkt
            colunas={COLUNAS}
            ordemInicial={{ coluna: 0, desc: false }}
            placeholder="Buscar nesta lista…"
            vazio="Nenhum evento nesse filtro."
            linhas={lista.map((e) => ({
              chave: e.gid,
              busca: `${e.nome} ${e.responsavel ?? ""}`,
              celulas: celulas(e),
              ordem: [
                e.inicio,
                e.nome,
                e.tipo ?? "~",
                e.cobranca ?? "~",
                e.responsavel ?? "~",
                e.concluido ? 1 : 0,
                null,
              ],
            }))}
            rodape={[
              "Total",
              plural(lista.length, "evento", "eventos"),
              "",
              "",
              "",
              "",
              "",
            ]}
          />
          <Fonte>
            {FONTE_ASANA}: projeto do calendário de Parâmetros. Data: início
            (start_on) e fim (due_on). Tipo e gratuita/paga pelas tags de
            Parâmetros; evento sem a tag aparece sem tipo.
          </Fonte>
        </Secao>
      ) : (
        <Secao titulo={`Calendário de ${formatarMes(mes)}`}>
          <Mes
            mes={mes}
            meses={meses}
            hoje={hoje}
            eventos={filtrados}
            busca={p.busca}
          />
          <div className="mt-3">
            <Legenda series={legenda} />
          </div>
          <Fonte>
            {FONTE_ASANA}: projeto do calendário de Parâmetros; cor pela tag de
            tipo. Clique no evento para abrir no Asana.
          </Fonte>
        </Secao>
      )}
    </>
  );
}

function Mes({
  mes,
  meses,
  hoje,
  eventos,
  busca,
}: {
  mes: string;
  meses: string[];
  hoje: string;
  eventos: EventoLinha[];
  busca: PropsAba["busca"];
}) {
  const fim = fimDoMes(mes);
  const de = segundaDa(mes);
  const ate = somarDias(segundaDa(fim), 6);
  const dias = datasDo({ de, ate });
  const porDia = eventosPorDia(eventos, de, ate);
  const i = meses.indexOf(mes);
  const ir = (k: number) => {
    const m = meses[k];
    return m ? hrefCom(BASE_RADAR, busca, { mes: m.slice(0, 7) }) : null;
  };
  const doMes = dias.filter((d) => d >= mes && d <= fim && porDia.has(d));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Navegar href={ir(i - 1)} rotulo="Mês anterior">
          <ChevronLeft className="size-4" aria-hidden />
        </Navegar>
        <span className="min-w-24 text-center text-sm font-semibold">
          {formatarMes(mes)}
        </span>
        <Navegar href={ir(i + 1)} rotulo="Próximo mês">
          <ChevronRight className="size-4" aria-hidden />
        </Navegar>
      </div>

      {/* Grade no computador; lista de dias no celular. */}
      <div className="hidden overflow-hidden rounded-2xl border border-neutral-900/[0.06] md:block">
        <div className="grid grid-cols-7 border-b border-neutral-900/[0.06] text-xs font-medium text-neutral-500">
          {SEMANA.map((d) => (
            <span key={d} className="px-3 py-2">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {dias.map((d) => {
            const fora = d < mes || d > fim;
            const evs = porDia.get(d) ?? [];
            return (
              <div
                key={d}
                className={`flex min-h-28 flex-col gap-1 border-r border-b border-neutral-900/[0.06] p-1.5 [&:nth-child(7n)]:border-r-0 ${fora ? "bg-neutral-900/[0.02]" : ""}`}
              >
                <span
                  className={`grid size-7 place-items-center rounded-full text-xs tabular-nums ${d === hoje ? "bg-neutral-900 font-semibold text-white" : fora ? "text-neutral-300" : "text-neutral-600"}`}
                >
                  {Number(d.slice(8, 10))}
                </span>
                {!fora && evs.map((e) => <Chip key={e.gid} e={e} />)}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2 md:hidden">
        {doMes.length === 0 && (
          <p className="text-sm text-neutral-500">Nenhum evento neste mês.</p>
        )}
        {doMes.map((d) => (
          <div key={d} className="flex flex-col gap-1">
            <h3 className="text-xs font-semibold text-neutral-600">
              {SEMANA[(diaDaSemana(d) + 6) % 7]}, {formatarData(d)}
            </h3>
            {(porDia.get(d) ?? []).map((e) => (
              <Chip key={e.gid} e={e} largo />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Navegar({
  href,
  rotulo,
  children,
}: {
  href: string | null;
  rotulo: string;
  children: React.ReactNode;
}) {
  const classe =
    "grid size-8 place-items-center rounded-full border border-neutral-900/10";
  return href ? (
    <Link
      href={href}
      scroll={false}
      aria-label={rotulo}
      className={`${classe} text-neutral-700 hover:bg-white`}
    >
      {children}
    </Link>
  ) : (
    <span aria-hidden className={`${classe} text-neutral-300`}>
      {children}
    </span>
  );
}

function Chip({ e, largo = false }: { e: EventoLinha; largo?: boolean }) {
  const cor = COR_TIPO[e.tipo ?? "sem"];
  return (
    <a
      href={e.link}
      target="_blank"
      rel="noopener noreferrer"
      title={`${e.nome}${e.tipo ? ` · ${TIPOS_EVENTO[e.tipo]}` : ""}${e.cobranca ? ` · ${COBRANCAS[e.cobranca]}` : ""}${e.responsavel ? ` · ${e.responsavel}` : ""}`}
      className={`block rounded-lg border-l-[3px] bg-white/70 px-1.5 py-1 text-xs hover:bg-white ${largo ? "" : "truncate"}`}
      style={{
        borderLeftColor: corDa(cor),
      }}
    >
      <span className="font-medium">{e.nome}</span>
      {largo && (
        <span className="block text-neutral-500">
          {[
            e.tipo ? TIPOS_EVENTO[e.tipo] : "Sem tipo",
            e.cobranca ? COBRANCAS[e.cobranca] : null,
            e.responsavel,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      )}
    </a>
  );
}

const COLUNAS = [
  { titulo: "Data" },
  { titulo: "Evento", classe: "min-w-56 max-w-80 whitespace-normal" },
  { titulo: "Tipo" },
  { titulo: "Gratuita ou paga" },
  { titulo: "Responsável" },
  { titulo: "Situação" },
  { titulo: "" },
];

function Ponto({ cor }: { cor: CorSerie }) {
  return (
    <span
      aria-hidden
      className="mr-1.5 inline-block size-2 rounded-full align-middle"
      style={{
        backgroundColor: corDa(cor),
      }}
    />
  );
}

function celulas(e: EventoLinha): React.ReactNode[] {
  return [
    <span key="d" className="whitespace-nowrap tabular-nums">
      {formatarData(e.inicio)}
      {e.fim !== e.inicio && (
        <span className="block text-xs text-neutral-500">
          até {formatarData(e.fim)}
        </span>
      )}
    </span>,
    <span key="n" className="font-medium">
      {e.nome}
    </span>,
    e.tipo ? (
      <span key="t" className="whitespace-nowrap">
        <Ponto cor={COR_TIPO[e.tipo]} />
        {TIPOS_EVENTO[e.tipo]}
      </span>
    ) : (
      <Vazio key="t" texto="Sem tag" />
    ),
    e.cobranca ? COBRANCAS[e.cobranca] : <Vazio key="c" texto="Sem tag" />,
    e.responsavel ?? <Vazio key="r" texto="Sem responsável" />,
    <SeloStatus
      key="s"
      status={e.concluido ? "ok" : "sem_meta"}
      rotulo={e.concluido ? "Concluído" : "Em aberto"}
    />,
    <AbrirNaFerramenta key="l" href={e.link} ferramenta="Asana" compacto />,
  ];
}

const COLUNAS_EXPORTAR = [
  { titulo: "Início" },
  { titulo: "Fim" },
  { titulo: "Evento" },
  { titulo: "Tipo" },
  { titulo: "Gratuita ou paga" },
  { titulo: "Responsável" },
  { titulo: "Situação" },
  { titulo: "Link" },
];
