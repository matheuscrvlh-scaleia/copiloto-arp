import { CalendarDays, CircleDot, Leaf } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { BarraDeFiltros } from "@/components/dashboard/barra-de-filtros";
import { Nota, Secao } from "@/components/dashboard/tabela";
import {
  type ColunaLista,
  type LinhaLista,
  TabelaLista,
} from "@/components/dashboard/tabela-lista";
import {
  CartaoDaTela,
  Cartoes,
  hrefCom,
  TopoDaTela,
} from "@/components/dashboard/tela";
import { BotaoExportar, type ColunaExportar } from "@/components/os/exportar";
import { Cartao, PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { CadastroDoPrograma } from "@/components/sustentabilidade/programas/cadastro";
import {
  fimDoMes,
  formatarData,
  formatarMes,
  formatarNumero,
  ultimasCompetencias,
} from "@/lib/formato";
import { linhaDeFiltros } from "@/lib/marketing/periodo";
import { permissaoDoPrograma } from "@/lib/permissions";
import { formatarMesNumerico } from "@/lib/sustentabilidade/formatos";
import {
  calcularDoPrograma,
  formatarValorDoIndicador,
  indicadoresVisiveis,
  somaDoGrupoNoMes,
} from "@/lib/sustentabilidade/programas-indicadores";
import { type Busca, filtrosLembrados } from "@/server/preferencias/filtros";
import { contextoSu, parametros } from "@/server/sustentabilidade/base";
import {
  cadastroVisivel,
  lancamentosParaIndicadores,
  movimentoDoMes,
} from "@/server/sustentabilidade/programas";

export const metadata: Metadata = { title: "Programas" };

const BASE = "/sustentabilidade/programas";
const FONTE = "Módulo – cadastro e lançamentos dos programas";
const SITUACOES = { "": "Ativos", inativos: "Inativos", todos: "Todos" };
type Situacao = keyof typeof SITUACOES;
const CARTOES = ["ativos", "com", "sem", "pessoas"] as const;
type CartaoChave = (typeof CARTOES)[number];
const PESSOAS = "pessoas impactadas";

export default function Page({
  searchParams,
}: PageProps<"/sustentabilidade/programas">) {
  return (
    <>
      <PageHeader
        title="Programas"
        description="SustentArp, Mercado Local, Turismo e os que vierem: cada um com formulário, indicadores, lançamentos e o link do parceiro."
      />
      <Suspense fallback={<Esqueleto />}>
        <Tela busca={searchParams} />
      </Suspense>
    </>
  );
}

async function Tela({ busca: buscaUrl }: { busca: Promise<Busca> }) {
  const ctx = await contextoSu();
  const gerencia = ctx.pode("sustentabilidade.programas.gerenciar");
  if (!gerencia && !ctx.programas.length) return <SemAcesso />;
  const [f, p, cadastro] = await Promise.all([
    buscaUrl.then((b) => filtrosLembrados("sustentabilidade", "programas", b)),
    parametros(),
    cadastroVisivel(),
  ]);
  const um = (k: string) => {
    const v = f.busca[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  // Quem só lança vê os seus programas (painel não entra aqui).
  const programasDaPessoa = gerencia
    ? cadastro.programas
    : cadastro.programas.filter((x) =>
        ctx.programas.includes(permissaoDoPrograma(x.id)),
      );
  const atual = `${ctx.hoje.slice(0, 7)}-01`;
  const meses = ultimasCompetencias(atual, 24).reverse();
  const mes = meses.find((m) => m.slice(0, 7) === um("mes")) ?? atual;
  const situacao: Situacao =
    um("situacao") in SITUACOES ? (um("situacao") as Situacao) : "";
  const areas = [
    ...new Set([
      ...p.areas_impacto,
      ...programasDaPessoa.map((x) => x.area).filter((a): a is string => !!a),
    ]),
  ];
  const area = areas.includes(um("area")) ? um("area") : "";
  const cartao = (CARTOES as readonly string[]).includes(um("cartao"))
    ? (um("cartao") as CartaoChave)
    : "";
  const comValores = ctx.pode("sustentabilidade.valores");
  const exportar = ctx.pode("sustentabilidade.exportar");

  const daArea = programasDaPessoa.filter((x) => !area || x.area === area);
  const naSituacao = daArea.filter((x) =>
    situacao === "todos" ? true : situacao === "inativos" ? !x.ativo : x.ativo,
  );
  const ids = daArea.map((x) => x.id);
  const [movimento, lancamentos] = await Promise.all([
    movimentoDoMes(mes, ids),
    ids.length
      ? lancamentosParaIndicadores({ de: mes, ate: fimDoMes(mes) })
      : Promise.resolve([]),
  ]);
  const totalDe = (id: string) => {
    const m = movimento.get(id);
    return m ? m.equipe + m.link + m.importacao : 0;
  };
  const grupoPessoas = p.grupos_impacto.find(
    (g) => g.trim().toLowerCase() === PESSOAS,
  );
  const indicadores = cadastro.indicadores.filter((i) =>
    ids.includes(i.programa_id),
  );
  const doGrupoPessoas = new Set(
    indicadoresVisiveis(indicadores, comValores)
      .filter((i) => grupoPessoas && i.grupo === grupoPessoas)
      .map((i) => i.programa_id),
  );
  const semLancamento = (id: string) => {
    const x = daArea.find((y) => y.id === id);
    return !!x && x.ativo && x.frequencia === "mensal" && totalDe(id) === 0;
  };

  const n = {
    ativos: daArea.filter((x) => x.ativo).length,
    com: daArea.reduce((t, x) => t + totalDe(x.id), 0),
    sem: daArea.filter((x) => semLancamento(x.id)).length,
    pessoas: grupoPessoas
      ? somaDoGrupoNoMes(
          grupoPessoas,
          indicadores,
          lancamentos,
          mes,
          comValores,
        )
      : null,
  };
  const lista = naSituacao.filter((x) =>
    cartao === "ativos"
      ? x.ativo
      : cartao === "com"
        ? totalDe(x.id) > 0
        : cartao === "sem"
          ? semLancamento(x.id)
          : cartao === "pessoas"
            ? doGrupoPessoas.has(x.id)
            : true,
  );

  const rotuloMes = formatarMes(mes);
  const ROTULO_CARTAO: Record<CartaoChave, string> = {
    ativos: "Programas ativos",
    com: "Lançamentos no mês",
    sem: "Programas sem lançamento no mês",
    pessoas: "Pessoas impactadas no mês",
  };
  const filtros = linhaDeFiltros([
    { rotulo: "Mês", valor: rotuloMes },
    { rotulo: "Situação", valor: SITUACOES[situacao] },
    { rotulo: "Área de impacto", valor: area || "Todas" },
    ...(cartao ? [{ rotulo: "Cartão", valor: ROTULO_CARTAO[cartao] }] : []),
  ]);
  const exemplo = programasDaPessoa.some((x) => x.exemplo)
    ? "programas e lançamentos marcados como exemplo"
    : undefined;

  const indicadoresDoMes = (programaId: string) =>
    indicadoresVisiveis(
      indicadores.filter((i) => i.programa_id === programaId),
      comValores,
    )
      .slice(0, 3)
      .map((i) => ({
        nome: i.nome,
        texto: formatarValorDoIndicador(
          calcularDoPrograma(i, lancamentos, [mes]).periodo,
          i,
        ),
      }));

  const linhas: LinhaLista[] = lista.map((x) => {
    const m = movimento.get(x.id);
    const total = totalDe(x.id);
    const ind = indicadoresDoMes(x.id);
    return {
      chave: x.id,
      href: `${BASE}/${x.id}?mes=${mes.slice(0, 7)}`,
      busca: `${x.nome} ${x.area ?? ""} ${x.parceiro_nome ?? ""}`,
      ordem: [
        x.nome,
        x.area,
        x.parceiro_nome,
        x.ativo ? "Ativo" : "Inativo",
        total,
        m?.ultimo ?? null,
        null,
      ],
      celulas: [
        <span key="n" className="flex flex-col">
          <span className="font-medium">{x.nome}</span>
          {x.descricao && (
            <span className="text-xs text-neutral-500">{x.descricao}</span>
          )}
        </span>,
        x.area ?? "—",
        x.parceiro_nome ?? "—",
        <span
          key="s"
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${x.ativo ? "bg-green-400/20 text-green-800" : "bg-neutral-500/15 text-neutral-600"}`}
        >
          {x.ativo ? "Ativo" : "Inativo"}
        </span>,
        <span key="l" className="flex flex-col items-end">
          <span>{formatarNumero(total)}</span>
          {total > 0 && (
            <span className="text-xs text-neutral-500">
              equipe {formatarNumero((m?.equipe ?? 0) + (m?.importacao ?? 0))} ·
              link {formatarNumero(m?.link ?? 0)}
            </span>
          )}
        </span>,
        m?.ultimo ? formatarData(m.ultimo) : "nenhum",
        ind.length ? (
          <ul key="i" className="flex flex-col gap-0.5 text-xs">
            {ind.map((v) => (
              <li key={v.nome}>
                <span className="text-neutral-500">{v.nome}:</span>{" "}
                {v.texto === "sem dado"
                  ? `sem dado em ${formatarMesNumerico(mes)}`
                  : v.texto}
              </li>
            ))}
          </ul>
        ) : (
          <span key="i" className="text-xs text-neutral-500">
            sem indicador
          </span>
        ),
      ],
    };
  });

  const colunas: ColunaLista[] = [
    { titulo: "Programa", classe: "min-w-48" },
    { titulo: "Área de impacto" },
    { titulo: "Parceiro", classe: "min-w-36" },
    { titulo: "Situação" },
    { titulo: "Lançamentos no mês", numero: true },
    { titulo: "Último lançamento" },
    { titulo: "Indicadores do mês", classe: "min-w-56" },
  ];
  const colunasExportar: ColunaExportar[] = [
    { titulo: "Programa" },
    { titulo: "Área de impacto" },
    { titulo: "Parceiro" },
    { titulo: "Situação" },
    { titulo: "Lançamentos no mês", numero: true },
    { titulo: "Pela equipe", numero: true },
    { titulo: "Pelo link", numero: true },
    { titulo: "Último lançamento" },
    { titulo: "Indicadores do mês" },
  ];
  const linhasExportar = lista.map((x) => {
    const m = movimento.get(x.id);
    return [
      x.nome,
      x.area ?? "",
      x.parceiro_nome ?? "",
      x.ativo ? "Ativo" : "Inativo",
      totalDe(x.id),
      (m?.equipe ?? 0) + (m?.importacao ?? 0),
      m?.link ?? 0,
      m?.ultimo ? formatarData(m.ultimo) : "",
      indicadoresDoMes(x.id)
        .map((v) => `${v.nome}: ${v.texto}`)
        .join("; "),
    ];
  });

  return (
    <div className="flex flex-col gap-6">
      <BarraDeFiltros
        modulo="sustentabilidade"
        tela="programas"
        hoje={ctx.hoje}
        lembrado={f.lembrado}
        selecoes={[
          {
            chave: "mes",
            rotulo: "Mês",
            todos: `Mês atual (${formatarMes(atual)})`,
            valor: mes === atual ? "" : mes.slice(0, 7),
            icone: <CalendarDays className="size-4" />,
            largura: "w-56",
            opcoes: meses
              .filter((m) => m !== atual)
              .map((m) => ({ valor: m.slice(0, 7), rotulo: formatarMes(m) })),
          },
          {
            chave: "situacao",
            rotulo: "Situação",
            todos: "Ativos",
            valor: situacao,
            icone: <CircleDot className="size-4" />,
            opcoes: [
              { valor: "inativos", rotulo: "Inativos" },
              { valor: "todos", rotulo: "Todos" },
            ],
          },
          {
            chave: "area",
            rotulo: "Área de impacto",
            todos: "Todas as áreas",
            valor: area,
            icone: <Leaf className="size-4" />,
            largura: "w-52",
            opcoes: areas.map((a) => ({ valor: a, rotulo: a })),
          },
        ]}
      />

      <TopoDaTela
        dadosDe={ctx.dadosDe}
        filtros={filtros}
        exemplo={exemplo}
        acoes={
          <>
            {exportar && (
              <BotaoExportar
                titulo="Programas"
                filtros={`${filtros} · ${ctx.dadosDe}`}
                nomeArquivo="programas"
                colunas={colunasExportar}
                linhas={linhasExportar}
              />
            )}
            {gerencia && (
              <CadastroDoPrograma
                areas={p.areas_impacto}
                podeContato={ctx.pode("sustentabilidade.contato")}
              />
            )}
          </>
        }
      />

      <Cartoes modulo="sustentabilidade">
        <CartaoDaTela
          titulo="Programas ativos"
          valor={formatarNumero(n.ativos)}
          detalhe={`de ${formatarNumero(daArea.length)} cadastrados`}
          fonte={FONTE}
          href={hrefCom(BASE, f.busca, {
            cartao: cartao === "ativos" ? null : "ativos",
          })}
          ativo={cartao === "ativos"}
        />
        <CartaoDaTela
          titulo="Lançamentos no mês"
          valor={formatarNumero(n.com)}
          detalhe={`Equipe e link, em ${rotuloMes}`}
          fonte={FONTE}
          href={hrefCom(BASE, f.busca, {
            cartao: cartao === "com" ? null : "com",
          })}
          ativo={cartao === "com"}
        />
        <CartaoDaTela
          titulo="Programas sem lançamento no mês"
          valor={formatarNumero(n.sem)}
          detalhe={`Ativos com frequência mensal; a partir do dia ${p.cobranca_dia} (parâmetro) viram chamado de cobrança`}
          fonte={FONTE}
          href={hrefCom(BASE, f.busca, {
            cartao: cartao === "sem" ? null : "sem",
          })}
          ativo={cartao === "sem"}
        />
        <CartaoDaTela
          titulo="Pessoas impactadas no mês"
          valor={
            !grupoPessoas
              ? "—"
              : n.pessoas === null
                ? `sem dado em ${formatarMesNumerico(mes)}`
                : formatarNumero(n.pessoas)
          }
          detalhe={
            grupoPessoas
              ? `Soma do grupo “${grupoPessoas}” dos indicadores`
              : "O grupo “Pessoas impactadas” não está nos Parâmetros"
          }
          fonte="Aba Indicadores de cada programa"
          href={hrefCom(BASE, f.busca, {
            cartao: cartao === "pessoas" ? null : "pessoas",
          })}
          ativo={cartao === "pessoas"}
        />
      </Cartoes>

      {programasDaPessoa.length === 0 ? (
        <Cartao>
          <p className="text-sm text-neutral-600">
            {gerencia
              ? "Nenhum programa cadastrado ainda. Crie o primeiro em “Novo programa”; depois monte o formulário, defina os indicadores e gere o link do parceiro."
              : "Nenhum programa liberado para você. Peça à responsável pela área a permissão “Programa – lançar” do programa."}
          </p>
        </Cartao>
      ) : (
        <Secao
          titulo="Programas"
          descricao={`Lançamentos e indicadores de ${rotuloMes}. Clique no programa para ver o resumo, os lançamentos e o link do parceiro.`}
        >
          <div data-guia="lista-programas">
            <TabelaLista
              colunas={colunas}
              linhas={linhas}
              ordemInicial={{ coluna: 0, desc: false }}
              placeholder="Buscar programa, área ou parceiro…"
              vazio="Nenhum programa com estes filtros."
              rodape={[
                `${formatarNumero(lista.length)} ${lista.length === 1 ? "programa" : "programas"}`,
                "",
                "",
                "",
                formatarNumero(lista.reduce((t, x) => t + totalDe(x.id), 0)),
                "",
                "",
              ]}
            />
          </div>
          {exemplo && (
            <div className="mt-3">
              <Nota>
                Dados de exemplo (fictícios) nos programas iniciais: saem quando
                os dados de exemplo forem removidos nos Parâmetros.
              </Nota>
            </div>
          )}
        </Secao>
      )}
    </div>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <IndicadoresCarregando
        className="sm:grid-cols-2 xl:grid-cols-4"
        quantidade={4}
      />
      <CartaoCarregando altura="h-[28rem]" />
    </TelaCarregando>
  );
}
