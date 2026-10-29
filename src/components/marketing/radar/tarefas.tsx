import { CalendarClock, Filter, FolderKanban, Tag, User } from "lucide-react";
import { ColunasEmpilhadas } from "@/components/dashboard/graficos/colunas-empilhadas";
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
import {
  formatarData,
  formatarMes,
  formatarNumero,
  formatarPct,
} from "@/lib/formato";
import { linhaDeFiltros, mesesAte, somarDias } from "@/lib/marketing/periodo";
import {
  contarTarefas,
  estaAberta,
  type PessoaLinha,
  prazoDoMes,
  quadroPorPessoa,
  rotuloSemPrazo,
  SITUACOES_TAREFA,
  type TarefaLinha,
  venceEm7,
} from "@/lib/marketing/radar";
import { BASE_RADAR, FONTE_ASANA, type PropsAba, plural, Vazio } from "./comum";

// Aba "Tarefas do time" (spec 4.9): cartões, a lista com filtros, o quadro
// por pessoa (no lugar do gráfico de fim de mês) e o prazo mês a mês.

const SEM_RESPONSAVEL = "_sem";
const SITUACAO_OPCOES = [
  { valor: "atrasadas", rotulo: "Só atrasadas" },
  { valor: "concluidas", rotulo: "Concluídas" },
  { valor: "todas", rotulo: "Todas" },
];
const PRAZO_OPCOES = [
  { valor: "vence7", rotulo: "Vencem nos próximos 7 dias" },
  { valor: "mes", rotulo: "Prazo neste mês" },
  { valor: "sem_prazo", rotulo: "Sem prazo" },
];
const CARTOES: Record<string, string> = {
  atrasadas: "Atrasadas",
  vence7: "Vencem nos próximos 7 dias",
  concluidas_mes: "Concluídas no mês",
};

export function AbaTarefas({
  p,
  linhas,
  projetos,
  diasAtrasoAlerta,
}: {
  p: PropsAba;
  /** Tarefas dos projetos do Marketing (todas as situações). */
  linhas: TarefaLinha[];
  /** Projetos do Marketing de Configurações. */
  projetos: string[];
  /** Limite da regra tarefa_atrasada (dias), se ligada. */
  diasAtrasoAlerta: number | null;
}) {
  const { hoje } = p;
  const projeto = p.um("projeto");
  const responsavel = p.um("responsavel");
  const tag = p.um("tag");
  const situacao = p.um("situacao");
  const prazo = p.um("prazo");
  const cartao = p.um("cartao");
  const q = p.um("q").trim().toLowerCase();
  const mes = `${hoje.slice(0, 7)}-01`;
  const [mesPassado] = mesesAte(somarDias(mes, -1), 1) as [string];

  // Projeto, responsável, tag e busca valem para tudo; situação e prazo só
  // para a lista (e o cartão clicado troca os dois).
  const base = linhas.filter(
    (l) =>
      (!projeto || l.projeto === projeto) &&
      (!responsavel ||
        (responsavel === SEM_RESPONSAVEL
          ? l.responsavel === null
          : l.responsavel === responsavel)) &&
      (!tag || l.tags.includes(tag)) &&
      (!q ||
        `${l.nome} ${l.responsavel ?? ""} ${l.tags.join(" ")}`
          .toLowerCase()
          .includes(q)),
  );
  const c = contarTarefas(base, hoje, diasAtrasoAlerta);
  const doMes = prazoDoMes(base, mes);
  const doMesPassado = prazoDoMes(base, mesPassado);

  const lista = base.filter((l) => {
    if (cartao === "atrasadas") return l.situacao === "atrasada";
    if (cartao === "vence7") return venceEm7(l, hoje);
    if (cartao === "concluidas_mes")
      return l.concluidaEm?.slice(0, 7) === hoje.slice(0, 7);
    const s =
      situacao === "todas"
        ? true
        : situacao === "atrasadas"
          ? l.situacao === "atrasada"
          : situacao === "concluidas"
            ? l.situacao === "concluida"
            : estaAberta(l);
    const pz =
      prazo === "vence7"
        ? !!l.prazo && l.prazo >= hoje && l.prazo <= somarDias(hoje, 6)
        : prazo === "mes"
          ? l.prazo?.slice(0, 7) === hoje.slice(0, 7)
          : prazo === "sem_prazo"
            ? !l.prazo
            : true;
    return s && pz;
  });

  const pessoas = quadroPorPessoa(base, mes);
  const meses = mesesAte(hoje, 6);
  const porMes = meses.map((m) => prazoDoMes(base, m));

  const responsaveis = [
    ...new Set(linhas.map((l) => l.responsavel).filter((r) => r !== null)),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const tags = [...new Set(linhas.flatMap((l) => l.tags))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );

  const linhaFiltros = linhaDeFiltros([
    { rotulo: "Projeto", valor: projeto || "Todos os projetos do Marketing" },
    {
      rotulo: "Responsável",
      valor:
        responsavel === SEM_RESPONSAVEL
          ? "Sem responsável"
          : responsavel || "Todos",
    },
    { rotulo: "Tag", valor: tag || "Todas" },
    ...(cartao
      ? [{ rotulo: "Cartão", valor: CARTOES[cartao] ?? cartao }]
      : [
          {
            rotulo: "Situação",
            valor:
              SITUACAO_OPCOES.find((o) => o.valor === situacao)?.rotulo ??
              "Abertas",
          },
          {
            rotulo: "Prazo",
            valor:
              PRAZO_OPCOES.find((o) => o.valor === prazo)?.rotulo ?? "Todos",
          },
        ]),
    ...(q ? [{ rotulo: "Busca", valor: p.um("q") }] : []),
  ]);
  const hrefCartao = (k: string | null) =>
    hrefCom(BASE_RADAR, p.busca, { cartao: cartao === k ? null : k });
  const alerta = (l: TarefaLinha) =>
    diasAtrasoAlerta !== null && (l.diasAtraso ?? 0) > diasAtrasoAlerta;

  return (
    <>
      <BarraDeFiltros
        tela="radar"
        hoje={hoje}
        lembrado={p.lembrado}
        selecoes={[
          {
            chave: "projeto",
            rotulo: "Projeto",
            todos: "Todos os projetos do Marketing",
            valor: projeto,
            icone: <FolderKanban className="size-4" />,
            largura: "w-56",
            opcoes: projetos.map((n) => ({ valor: n, rotulo: n })),
          },
          {
            chave: "responsavel",
            rotulo: "Responsável",
            todos: "Todos os responsáveis",
            valor: responsavel,
            icone: <User className="size-4" />,
            largura: "w-48",
            opcoes: [
              ...responsaveis.map((r) => ({ valor: r, rotulo: r })),
              { valor: SEM_RESPONSAVEL, rotulo: "Sem responsável" },
            ],
          },
          {
            chave: "tag",
            rotulo: "Tag",
            todos: "Todas as tags",
            valor: tag,
            icone: <Tag className="size-4" />,
            opcoes: tags.map((t) => ({ valor: t, rotulo: t })),
          },
          {
            chave: "situacao",
            rotulo: "Situação",
            todos: "Abertas",
            valor: situacao,
            icone: <Filter className="size-4" />,
            opcoes: SITUACAO_OPCOES,
          },
          {
            chave: "prazo",
            rotulo: "Prazo",
            todos: "Qualquer prazo",
            valor: prazo,
            icone: <CalendarClock className="size-4" />,
            largura: "w-56",
            opcoes: PRAZO_OPCOES,
          },
        ]}
        busca={{ chave: "q", valor: p.um("q"), placeholder: "Buscar tarefa…" }}
      />

      <TopoDaTela
        dadosDe={p.dadosDe}
        filtros={linhaFiltros}
        acoes={
          p.exportar ? (
            <BotaoExportar
              titulo="Tarefas do time"
              filtros={`${linhaFiltros} · ${p.dadosDe}`}
              nomeArquivo="tarefas-do-time"
              colunas={COLUNAS_EXPORTAR}
              linhas={exportarLista(lista)}
            />
          ) : undefined
        }
      />

      <Cartoes>
        <CartaoMkt
          titulo="Abertas"
          valor={formatarNumero(c.abertas)}
          detalhe="Inclui as atrasadas"
          fonte={FONTE_ASANA}
          href={
            cartao ? hrefCom(BASE_RADAR, p.busca, { cartao: null }) : undefined
          }
        />
        <CartaoMkt
          titulo="Atrasadas"
          valor={formatarNumero(c.atrasadas)}
          status={c.atrasadasHaMais > 0 ? "atencao" : undefined}
          detalhe={
            diasAtrasoAlerta !== null
              ? `${plural(c.atrasadasHaMais, "atrasada", "atrasadas")} há mais de ${diasAtrasoAlerta} dias`
              : undefined
          }
          calculo="Abertas com prazo antes de hoje."
          fonte={FONTE_ASANA}
          href={hrefCartao("atrasadas")}
          ativo={cartao === "atrasadas"}
        />
        <CartaoMkt
          titulo="Vencem nos próximos 7 dias"
          valor={formatarNumero(c.vencem7)}
          detalhe={`Prazo de ${formatarData(hoje)} a ${formatarData(somarDias(hoje, 6))}`}
          fonte={FONTE_ASANA}
          href={hrefCartao("vence7")}
          ativo={cartao === "vence7"}
        />
        <CartaoMkt
          titulo="Concluídas no mês no prazo"
          valor={formatarPct(doMes.pct)}
          detalhe={`${doMes.noPrazo} de ${doMes.noPrazo + doMes.comAtraso} · ${rotuloSemPrazo(doMes.semPrazo)} · ${formatarMes(mesPassado)}: ${formatarPct(doMesPassado.pct)}`}
          calculo="No prazo: concluída até o dia do prazo. Tarefa sem prazo não entra no %."
          fonte={FONTE_ASANA}
          href={hrefCartao("concluidas_mes")}
          ativo={cartao === "concluidas_mes"}
        />
      </Cartoes>

      <Secao
        titulo="Tarefas"
        descricao="Uma linha por tarefa dos projetos do Marketing, da mais atrasada para a de prazo mais longe."
      >
        <TabelaMkt
          colunas={COLUNAS}
          ordemInicial={{ coluna: 3, desc: false }}
          placeholder="Buscar nesta lista…"
          vazio="Nenhuma tarefa nesse filtro."
          linhas={lista.map((l) => ({
            chave: l.gid,
            busca: `${l.nome} ${l.projeto} ${l.responsavel ?? ""} ${l.tags.join(" ")}`,
            tom: alerta(l) ? "atencao" : undefined,
            celulas: celulas(l),
            ordem: [
              l.nome,
              `${l.projeto} ${l.secao ?? ""}`,
              l.responsavel ?? "~",
              l.prazo,
              l.diasAtraso,
              l.tags.join(", "),
              SITUACOES_TAREFA[l.situacao],
              null,
            ],
          }))}
          rodape={[
            "Total",
            plural(lista.length, "tarefa", "tarefas"),
            "",
            "",
            "",
            "",
            "",
            "",
          ]}
        />
        <Fonte>
          {FONTE_ASANA}: projetos do Marketing cadastrados em Configurações.
          {diasAtrasoAlerta !== null &&
            ` Linha em amarelo: atrasada há mais de ${diasAtrasoAlerta} dias (regra de alerta).`}{" "}
          O módulo só consulta: criar, concluir ou comentar é no Asana.
        </Fonte>
      </Secao>

      <Secao
        titulo="Quadro por pessoa"
        descricao={`Abertas hoje e o prazo das concluídas em ${formatarMes(mes)}. ${rotuloSemPrazo(doMes.semPrazo)}.`}
      >
        {p.exportar && (
          <div className="mb-3 flex justify-end">
            <BotaoExportar
              titulo="Tarefas do time — quadro por pessoa"
              filtros={`${linhaFiltros} · Mês: ${formatarMes(mes)} · ${p.dadosDe}`}
              nomeArquivo="tarefas-do-time-por-pessoa"
              colunas={COLUNAS_PESSOA_EXPORTAR}
              linhas={exportarPessoas(pessoas, prazoDoMes(base, mes), c)}
            />
          </div>
        )}
        <TabelaMkt
          colunas={COLUNAS_PESSOA}
          semBusca
          ordemInicial={{ coluna: 2, desc: true }}
          vazio="Ninguém com tarefa aberta ou concluída no mês."
          linhas={pessoas.map((x) => ({
            chave: x.responsavel ?? "_sem",
            busca: x.responsavel ?? "Sem responsável",
            href: hrefCom(BASE_RADAR, p.busca, {
              responsavel: x.responsavel ?? SEM_RESPONSAVEL,
              cartao: null,
            }),
            celulas: [
              x.responsavel ?? <Vazio key="r" texto="Sem responsável" />,
              formatarNumero(x.abertas),
              x.atrasadas ? (
                <span key="a" className="font-semibold text-red-700">
                  {formatarNumero(x.atrasadas)}
                </span>
              ) : (
                "0"
              ),
              formatarNumero(x.concluidas),
              x.pct === null ? (
                <Vazio key="p" />
              ) : (
                <span key="p">
                  <span className="font-semibold">{formatarPct(x.pct)}</span>
                  <span className="ml-1 text-xs text-neutral-500">
                    {x.noPrazo} de {x.noPrazo + x.comAtraso}
                  </span>
                </span>
              ),
              x.semPrazo ? formatarNumero(x.semPrazo) : <Vazio key="s" />,
            ],
            ordem: [
              x.responsavel ?? "~",
              x.abertas,
              x.atrasadas,
              x.concluidas,
              x.pct,
              x.semPrazo,
            ],
          }))}
          rodape={[
            "Total",
            formatarNumero(c.abertas),
            formatarNumero(c.atrasadas),
            formatarNumero(doMes.concluidas),
            formatarPct(doMes.pct),
            formatarNumero(doMes.semPrazo),
          ]}
        />
        <Fonte>
          {FONTE_ASANA}. No prazo: concluída até o dia do prazo (completed_at
          até due_on). Clique na pessoa para ver as tarefas dela.
        </Fonte>
      </Secao>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Secao
          titulo="Concluídas no prazo × com atraso"
          descricao="Últimos 6 meses, pelo mês da conclusão"
        >
          <ColunasEmpilhadas
            descricao="Tarefas concluídas por mês: no prazo, com atraso e sem prazo"
            pontos={meses.map((m) => ({
              chave: m,
              rotulo: formatarMes(m),
              titulo: `Concluídas em ${formatarMes(m)}`,
            }))}
            series={[
              {
                chave: "no_prazo",
                rotulo: "No prazo",
                cor: 1,
                valores: porMes.map((x) => x.noPrazo),
              },
              {
                chave: "atraso",
                rotulo: "Com atraso",
                cor: 3,
                valores: porMes.map((x) => x.comAtraso),
              },
              {
                chave: "sem_prazo",
                rotulo: "Sem prazo (fora do %)",
                cor: "neutro",
                valores: porMes.map((x) => x.semPrazo),
              },
            ]}
          />
          <Fonte>{FONTE_ASANA}</Fonte>
        </Secao>
        <Secao
          titulo="Abertas por responsável"
          descricao="Em dia, atrasadas e sem prazo, hoje"
        >
          <ColunasEmpilhadas
            descricao="Tarefas abertas por responsável e situação"
            pontos={pessoas
              .filter((x) => x.abertas > 0)
              .map((x) => ({
                chave: x.responsavel ?? "_sem",
                rotulo: primeiroNome(x.responsavel),
                titulo: x.responsavel ?? "Sem responsável",
              }))}
            series={seriesAbertas(pessoas.filter((x) => x.abertas > 0))}
          />
          <Fonte>{FONTE_ASANA}</Fonte>
        </Secao>
      </div>
    </>
  );
}

const primeiroNome = (n: string | null) => n?.split(" ")[0] ?? "Sem resp.";

function seriesAbertas(ps: PessoaLinha[]) {
  return [
    {
      chave: "em_dia",
      rotulo: "Em dia",
      cor: 1 as const,
      valores: ps.map((x) => x.emDia),
    },
    {
      chave: "atrasada",
      rotulo: "Atrasadas",
      cor: 3 as const,
      valores: ps.map((x) => x.atrasadas),
    },
    {
      chave: "sem_prazo",
      rotulo: "Sem prazo",
      cor: "neutro" as const,
      valores: ps.map((x) => x.abertasSemPrazo),
    },
  ];
}

const COLUNAS = [
  { titulo: "Tarefa", classe: "min-w-56 max-w-80 whitespace-normal" },
  { titulo: "Projeto / seção" },
  { titulo: "Responsável" },
  { titulo: "Prazo" },
  {
    titulo: "Dias de atraso",
    numero: true,
    dica: "Hoje − prazo, se aberta e vencida",
  },
  { titulo: "Tags" },
  { titulo: "Situação" },
  { titulo: "" },
];

const STATUS_SITUACAO = {
  aberta: "sem_meta",
  atrasada: "fora",
  concluida: "ok",
} as const;

function celulas(l: TarefaLinha): React.ReactNode[] {
  return [
    <span key="n" className="font-medium">
      {l.nome}
    </span>,
    <span key="p" className="whitespace-nowrap">
      {l.projeto}
      {l.secao && (
        <span className="block text-xs text-neutral-500">{l.secao}</span>
      )}
    </span>,
    l.responsavel ?? <Vazio key="r" texto="Sem responsável" />,
    l.prazo ? formatarData(l.prazo) : <Vazio key="d" texto="Sem prazo" />,
    l.diasAtraso === null ? (
      ""
    ) : (
      <span key="a" className="font-semibold text-red-700">
        {formatarNumero(l.diasAtraso)}
      </span>
    ),
    l.tags.length ? (
      <span key="t" className="flex flex-wrap gap-1">
        {l.tags.map((t) => (
          <span
            key={t}
            className="rounded-full bg-neutral-900/[0.06] px-2 py-0.5 text-xs"
          >
            {t}
          </span>
        ))}
      </span>
    ) : (
      ""
    ),
    <SeloStatus
      key="s"
      status={STATUS_SITUACAO[l.situacao]}
      rotulo={SITUACOES_TAREFA[l.situacao]}
    />,
    <AbrirNaFerramenta key="l" href={l.link} ferramenta="Asana" compacto />,
  ];
}

const COLUNAS_EXPORTAR = [
  { titulo: "Tarefa" },
  { titulo: "Projeto" },
  { titulo: "Seção" },
  { titulo: "Responsável" },
  { titulo: "Prazo" },
  { titulo: "Dias de atraso", numero: true },
  { titulo: "Tags" },
  { titulo: "Situação" },
  { titulo: "Link" },
];

function exportarLista(lista: TarefaLinha[]) {
  return [...lista]
    .sort((a, b) => (a.prazo ?? "9").localeCompare(b.prazo ?? "9"))
    .map((l) => [
      l.nome,
      l.projeto,
      l.secao ?? "",
      l.responsavel ?? "Sem responsável",
      l.prazo ? formatarData(l.prazo) : "Sem prazo",
      l.diasAtraso,
      l.tags.join(", "),
      SITUACOES_TAREFA[l.situacao],
      l.link,
    ]);
}

const COLUNAS_PESSOA = [
  { titulo: "Responsável" },
  { titulo: "Abertas", numero: true, dica: "Inclui as atrasadas" },
  { titulo: "Atrasadas", numero: true },
  { titulo: "Concluídas no mês", numero: true },
  {
    titulo: "% no prazo",
    numero: true,
    dica: "Tarefas sem prazo fora do cálculo",
  },
  { titulo: "Concluídas sem prazo", numero: true, dica: "Fora do %" },
];

const COLUNAS_PESSOA_EXPORTAR = [
  { titulo: "Responsável" },
  { titulo: "Abertas", numero: true },
  { titulo: "Atrasadas", numero: true },
  { titulo: "Concluídas no mês", numero: true },
  { titulo: "Concluídas no prazo", numero: true },
  { titulo: "% no prazo", numero: true, formato: "0.0" },
  { titulo: "Concluídas sem prazo (fora do %)", numero: true },
];

const r1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);

function exportarPessoas(
  ps: PessoaLinha[],
  mes: ReturnType<typeof prazoDoMes>,
  c: ReturnType<typeof contarTarefas>,
) {
  return [
    ...ps.map((x) => [
      x.responsavel ?? "Sem responsável",
      x.abertas,
      x.atrasadas,
      x.concluidas,
      x.noPrazo,
      r1(x.pct),
      x.semPrazo,
    ]),
    [
      "Total",
      c.abertas,
      c.atrasadas,
      mes.concluidas,
      mes.noPrazo,
      r1(mes.pct),
      mes.semPrazo,
    ],
  ];
}
