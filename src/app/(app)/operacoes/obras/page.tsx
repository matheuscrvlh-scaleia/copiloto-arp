import { CircleDot, Layers, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { Secao } from "@/components/dashboard/tabela";
import {
  CartaoDaTela,
  Cartoes,
  hrefCom,
  TopoDaTela,
} from "@/components/dashboard/tela";
import {
  AvisosDoDiario,
  BASE as BASE_DIARIO,
  dataHoraDoApp,
  FONTE as FONTE_DIARIO,
  pct,
  pontos,
  quando,
  SemDados,
  TopoDiario,
} from "@/components/operacoes/diario/comum";
import { FiltrosDiario } from "@/components/operacoes/diario/filtros";
import {
  type AlertaDaTela,
  Alertas,
  AvancoPorPrazo,
  alertasDoDiario,
  COLUNAS_EXPORTAR,
  linhasExportar,
} from "@/components/operacoes/diario/painel";
import { BotaoImportarOrcamento } from "@/components/operacoes/obras/botao-importar";
import {
  CartaoObra,
  type ObraDaTela,
} from "@/components/operacoes/obras/cartao-obra";
import { BotaoExportar } from "@/components/os/exportar";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import {
  formatarData,
  formatarMoeda,
  formatarNumero,
  formatarPct,
} from "@/lib/formato";
import { linhaDeFiltros } from "@/lib/marketing/periodo";
import {
  aAprovar,
  alertasDoPainel,
  cartoesDoPainel,
  type LinhaDoPainel,
  linhasDoPainel,
  OBRA_CONCLUIDA,
  OBRA_EM_ANDAMENTO,
  STATUS_OBRA,
} from "@/lib/operacoes/diario";
import {
  indicadoresDaObra,
  mesDoDia,
  rotuloMes,
  rotuloMesLongo,
} from "@/lib/operacoes/obras";
import type { CelulaExportar, ColunaExportar } from "@/lib/os/exportar";
import { contextoOp, parametros } from "@/server/operacoes/base";
import {
  datasDosRelatorios,
  estadoDoDiario,
  obrasDoDiario,
} from "@/server/operacoes/diario";
import { limitesDe, obrasComValores } from "@/server/operacoes/obras";

// Tela única das obras: a execução do aplicativo Diário de Obra (status,
// prazo, avanço físico, relatórios) e o orçamento da planilha (previsto ×
// realizado) de cada obra, juntos pelo vínculo de Dados da obra. Cada parte
// aparece para quem tem a permissão dela (operacoes.obras.diario e
// operacoes.obras.ver); o RLS confere de novo.

export const metadata: Metadata = { title: "Obras" };

const BASE = "/operacoes/obras";
const FONTE_ORC = "Planilha de orçamento (revisão vigente) e realizado lançado";
const CARTOES = {
  andamento: "Obras em andamento",
  vencido: "Prazo vencido",
  abaixo: "Abaixo do previsto",
  estouro: "Estouro do orçamento",
} as const;
type Cartao = keyof typeof CARTOES;

type Busca = Record<string, string | string[] | undefined>;
const um = (b: Busca, k: string) => {
  const v = b[k];
  return (Array.isArray(v) ? v[0] : v) ?? "";
};
const reais = (c: number) => formatarMoeda(c / 100);

export default function Page({ searchParams }: PageProps<"/operacoes/obras">) {
  return (
    <>
      <PageHeader
        title="Obras"
        description="Cada obra num lugar só: a execução lançada no aplicativo Diário de Obra (prazo, avanço físico e relatórios) e o orçamento da planilha (previsto × realizado, mês a mês)."
      />
      <Suspense fallback={<Esqueleto />}>
        <Tela busca={searchParams} />
      </Suspense>
    </>
  );
}

async function Tela({ busca }: { busca: Promise<Busca> }) {
  const [b, ctx] = await Promise.all([busca, contextoOp()]);
  const verOrc = ctx.pode("operacoes.obras.ver");
  const verExec = ctx.pode("operacoes.obras.diario");
  if (!verOrc && !verExec) return <SemAcesso />;

  const [p, obrasOrc, estado, obrasApp, relatorios] = await Promise.all([
    parametros(),
    verOrc ? obrasComValores() : Promise.resolve([]),
    verExec ? estadoDoDiario() : Promise.resolve(null),
    verExec ? obrasDoDiario() : Promise.resolve([]),
    verExec ? datasDosRelatorios() : Promise.resolve([]),
  ]);
  const importa = ctx.pode("operacoes.obras.importar");
  const mesRef = mesDoDia(ctx.hoje);
  const limites = limitesDe(p);

  // Junta as duas fontes: a obra do orçamento leva a do Diário ligada a ela;
  // obra do Diário sem vínculo entra sozinha.
  const linhasApp = linhasDoPainel(
    obrasApp,
    relatorios,
    p.obras_dias_relatorio,
    ctx.hoje,
  );
  const doApp = new Map(linhasApp.map((l) => [l.obra.id, l]));
  const ligadas = new Set<string>();
  const todas: ObraDaTela[] = obrasOrc.map((o) => {
    const exec = (o.diarioObraId && doApp.get(o.diarioObraId)) || null;
    if (exec) ligadas.add(exec.obra.id);
    return {
      chave: o.id,
      nome: o.nome,
      exec,
      orc: {
        id: o.id,
        responsavel: o.responsavel,
        ativa: o.ativa,
        exemplo: o.exemplo,
        revisao: o.vigente
          ? { codigo: o.vigente.codigo, data: o.vigente.data }
          : null,
        indicadores: indicadoresDaObra({
          orcado: o.vigente?.total ?? 0,
          previsto: o.previsto,
          realizado: o.realizado,
          mesRef,
          limites,
        }),
      },
    };
  });
  for (const l of linhasApp)
    if (!ligadas.has(l.obra.id))
      todas.push({
        chave: `app-${l.obra.id}`,
        nome: l.obra.nome,
        orc: null,
        exec: l,
      });
  const ativa = (o: ObraDaTela) =>
    o.orc ? o.orc.ativa : o.exec?.obra.statusId !== OBRA_CONCLUIDA;
  // Em andamento primeiro; dentro de cada grupo, pelo nome.
  todas.sort(
    (x, y) =>
      Number(ativa(y)) - Number(ativa(x)) ||
      x.nome.localeCompare(y.nome, "pt-BR"),
  );

  // Filtros (do aplicativo; o responsável vale para as duas fontes).
  const responsavelDe = (o: ObraDaTela) =>
    o.exec?.obra.responsavel ?? o.orc?.responsavel ?? null;
  const ordenar = (xs: (string | null | undefined)[]) =>
    [...new Set(xs.filter((x): x is string => !!x))].sort((x, y) =>
      x.localeCompare(y, "pt-BR"),
    );
  const grupos = ordenar(linhasApp.map((l) => l.obra.grupo));
  const responsaveis = ordenar(todas.map(responsavelDe));
  const status = Number(um(b, "status"));
  const statusValido = status in STATUS_OBRA ? status : 0;
  const grupo = grupos.includes(um(b, "grupo")) ? um(b, "grupo") : "";
  const responsavel = responsaveis.includes(um(b, "responsavel"))
    ? um(b, "responsavel")
    : "";
  // "situacao" é o nome antigo do filtro do orçamento (links salvos).
  const pedido = um(b, "cartao") || um(b, "situacao");
  const cartao = (pedido in CARTOES ? pedido : "") as Cartao | "";

  const base = todas.filter(
    (o) =>
      (!statusValido || o.exec?.obra.statusId === statusValido) &&
      (!grupo || o.exec?.obra.grupo === grupo) &&
      (!responsavel || responsavelDe(o) === responsavel),
  );
  const abaixoDoPrevisto = (o: ObraDaTela) =>
    !!o.orc?.ativa && o.orc.indicadores.ritmo.status === "fora";
  const estourou = (o: ObraDaTela) =>
    !!o.orc?.ativa && o.orc.indicadores.orcamento.status === "fora";
  const lista = base.filter((o) =>
    cartao === "andamento"
      ? o.exec?.obra.statusId === OBRA_EM_ANDAMENTO
      : cartao === "vencido"
        ? !!o.exec?.vencido
        : cartao === "abaixo"
          ? abaixoDoPrevisto(o)
          : cartao === "estouro"
            ? estourou(o)
            : true,
  );

  // Uma obra do Diário pode estar ligada a mais de uma do orçamento: conta uma vez.
  const execsDe = (xs: ObraDaTela[]) => [
    ...new Map(
      xs.flatMap((o) => (o.exec ? [[o.exec.obra.id, o.exec] as const] : [])),
    ).values(),
  ];
  const execBase = execsDe(base);
  const execLista = execsDe(lista);
  const c = cartoesDoPainel(execBase);
  const orcAtivas = base.filter((o) => o.orc?.ativa);
  const orcado = orcAtivas.reduce(
    (s, o) => s + (o.orc?.indicadores.orcado ?? 0),
    0,
  );
  const realizado = orcAtivas.reduce(
    (s, o) => s + (o.orc?.indicadores.realizado ?? 0),
    0,
  );
  const abaixo = base.filter(abaixoDoPrevisto).length;
  const estouro = base.filter(estourou).length;

  const limite = Number(p.obras_limite_desvio);
  const alertas: AlertaDaTela[] = [
    ...alertasDoDiario(
      alertasDoPainel(execLista, limite, { pct, pontos, data: formatarData }),
    ),
    ...lista.flatMap((o): AlertaDaTela[] =>
      o.orc
        ? [
            ...(estourou(o)
              ? [
                  {
                    chave: `orc-${o.orc.id}-estouro`,
                    grave: true,
                    texto: `${o.nome}: ${o.orc.indicadores.orcamento.detalhe}`,
                    href: `${BASE}/${o.orc.id}`,
                  },
                ]
              : []),
            ...(abaixoDoPrevisto(o)
              ? [
                  {
                    chave: `orc-${o.orc.id}-ritmo`,
                    grave: false,
                    texto: `${o.nome}: desembolso abaixo do previsto. ${o.orc.indicadores.ritmo.detalhe}`,
                    href: `${BASE}/${o.orc.id}`,
                  },
                ]
              : []),
          ]
        : [],
    ),
  ];
  const idsDaBase = new Set(execBase.map((l) => l.obra.id));
  const aprovarDesde = relatorios
    .filter((r) => idsDaBase.has(r.obraId) && aAprovar(r.statusId))
    .reduce<string | null>((m, r) => (!m || r.data < m ? r.data : m), null);

  const filtros = linhaDeFiltros([
    ...(linhasApp.length
      ? [
          {
            rotulo: "Status",
            valor: statusValido
              ? (STATUS_OBRA[statusValido]?.rotulo ?? "")
              : "Todos",
          },
          { rotulo: "Grupo", valor: grupo || "Todos" },
        ]
      : []),
    { rotulo: "Responsável", valor: responsavel || "Todos" },
    ...(cartao ? [{ rotulo: "Cartão", valor: CARTOES[cartao] }] : []),
    ...(verOrc
      ? [{ rotulo: "Mês de referência", valor: rotuloMesLongo(mesRef) }]
      : []),
  ]);
  const exemploOrc = obrasOrc.some((o) => o.exemplo)
    ? "obras, orçamentos e realizado, até a planilha real ser importada"
    : undefined;
  const hrefCartao = (k: Cartao) =>
    hrefCom(BASE, b, { cartao: cartao === k ? null : k, situacao: null });
  const dadosDe = estado?.ultima
    ? `Dados do Diário de Obra de ${quando(estado.ultima.em)}`
    : ctx.dadosDe;

  const acoes = (
    <>
      {importa && <BotaoImportarOrcamento />}
      {ctx.pode("operacoes.exportar") && (
        <BotaoExportar
          titulo="Obras · execução e orçamento"
          filtros={`${filtros} · ${dadosDe}`}
          nomeArquivo="obras"
          colunas={colunasExportar(verExec, verOrc, mesRef)}
          linhas={lista.map((o) => linhaExportar(o, verExec, verOrc))}
        />
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-6">
      {linhasApp.length > 0 && (
        <FiltrosDiario
          selecoes={[
            {
              chave: "status",
              rotulo: "Status da obra",
              todos: "Todos os status",
              valor: statusValido ? String(statusValido) : "",
              icone: <CircleDot className="size-4" />,
              opcoes: Object.entries(STATUS_OBRA).map(([valor, s]) => ({
                valor,
                rotulo: s.rotulo,
              })),
            },
            {
              chave: "grupo",
              rotulo: "Grupo",
              todos: "Todos os grupos",
              valor: grupo,
              icone: <Layers className="size-4" />,
              opcoes: grupos.map((g) => ({ valor: g, rotulo: g })),
            },
            {
              chave: "responsavel",
              rotulo: "Responsável",
              todos: "Todos os responsáveis",
              valor: responsavel,
              icone: <UserRound className="size-4" />,
              largura: "w-56",
              opcoes: responsaveis.map((r) => ({ valor: r, rotulo: r })),
            },
          ]}
        />
      )}

      {estado ? (
        <TopoDiario
          estado={estado}
          filtros={filtros}
          podeAtualizar={ctx.pode("operacoes.obras.atualizar")}
          exportar={acoes}
          outroExemplo={exemploOrc}
        />
      ) : (
        <TopoDaTela
          dadosDe={ctx.dadosDe}
          filtros={filtros}
          exemplo={exemploOrc}
          acoes={acoes}
        />
      )}
      {estado && <AvisosDoDiario estado={estado} />}

      {verExec && linhasApp.length > 0 && (
        <Grupo titulo="Execução" fonte="aplicativo Diário de Obra">
          <Cartoes modulo="operacoes">
            <CartaoDaTela
              titulo={CARTOES.andamento}
              valor={formatarNumero(c.emAndamento)}
              detalhe="Status 3 (Em andamento) no aplicativo"
              fonte={FONTE_DIARIO}
              href={hrefCartao("andamento")}
              ativo={cartao === "andamento"}
            />
            <CartaoDaTela
              titulo={CARTOES.vencido}
              valor={formatarNumero(c.vencidas)}
              detalhe="Não concluída, com “a vencer” 0 ou fim antes de hoje"
              status={c.vencidas ? "fora" : "ok"}
              fonte={FONTE_DIARIO}
              href={hrefCartao("vencido")}
              ativo={cartao === "vencido"}
            />
            <CartaoDaTela
              titulo="Avanço físico médio"
              valor={pct(c.avancoMedio)}
              detalhe="Média do “realizado” das obras em andamento"
              fonte={`${FONTE_DIARIO}, lista de tarefas`}
              href={hrefCartao("andamento")}
              ativo={cartao === "andamento"}
            />
            <CartaoDaTela
              titulo="Relatórios a aprovar"
              valor={formatarNumero(c.aAprovar)}
              detalhe="Preenchendo ou Revisar (status 1 e 3)"
              fonte={FONTE_DIARIO}
              href={`${BASE_DIARIO}/relatorios?status=aprovar${aprovarDesde ? `&de=${aprovarDesde}&ate=${ctx.hoje}` : ""}`}
            />
          </Cartoes>
        </Grupo>
      )}

      {verOrc && (
        <Grupo titulo="Orçamento" fonte="previsto × realizado da planilha">
          <Cartoes modulo="operacoes-orcamento">
            <CartaoDaTela
              titulo="Orçado (revisões vigentes)"
              valor={reais(orcado)}
              detalhe={`${formatarNumero(orcAtivas.length)} ${orcAtivas.length === 1 ? "obra em andamento" : "obras em andamento"}`}
              fonte={FONTE_ORC}
              calculo="Soma das etapas da revisão vigente de cada obra em andamento."
              exemplo={exemploOrc && "valores de exemplo"}
            />
            <CartaoDaTela
              titulo="Realizado acumulado"
              valor={reais(realizado)}
              detalhe={`${formatarPct(orcado > 0 ? (realizado / orcado) * 100 : null)} do orçado · saldo ${reais(orcado - realizado)}`}
              fonte={FONTE_ORC}
              calculo="Soma de todo o realizado lançado (e do trazido pela planilha na primeira importação) das obras em andamento."
              exemplo={exemploOrc && "valores de exemplo"}
            />
            <CartaoDaTela
              titulo={CARTOES.abaixo}
              valor={formatarNumero(abaixo)}
              detalhe={`Desvio abaixo de ${formatarNumero(limites.desvioPontos)} pontos até ${rotuloMes(mesRef)} (parâmetro)`}
              status={abaixo ? "fora" : "ok"}
              fonte={FONTE_ORC}
              href={hrefCartao("abaixo")}
              ativo={cartao === "abaixo"}
            />
            <CartaoDaTela
              titulo={CARTOES.estouro}
              valor={formatarNumero(estouro)}
              detalhe={`Realizado acima do orçado em mais de ${formatarNumero(limites.orcamentoPct)}% (parâmetro)`}
              status={estouro ? "fora" : "ok"}
              fonte={FONTE_ORC}
              href={hrefCartao("estouro")}
              ativo={cartao === "estouro"}
            />
          </Cartoes>
        </Grupo>
      )}

      <Secao
        titulo="Obras"
        descricao={[
          "Uma obra por cartão, com a execução (aplicativo Diário de Obra) e o orçamento (planilha) lado a lado; as duas partes se juntam em Dados da obra.",
          verExec
            ? `Dias sem relatório: ${diasQueContam(p.obras_dias_relatorio)} (Parâmetros), do início da obra até ontem, só obras em andamento.`
            : null,
          verOrc
            ? `Ritmo: realizado acumulado ÷ previsto acumulado até ${rotuloMesLongo(mesRef)}.`
            : null,
        ]
          .filter(Boolean)
          .join(" ")}
        calculo={
          verExec
            ? "Prazo consumido = decorrido ÷ prazo contratual. Desvio = avanço físico − prazo consumido (pontos). Avanço físico = “realizado” da lista de tarefas do aplicativo."
            : undefined
        }
      >
        {lista.length === 0 ? (
          todas.length === 0 ? (
            <div className="flex flex-col gap-4 py-2">
              {verOrc && (
                <p className="text-sm text-neutral-500">
                  Nenhuma obra no orçamento. A obra entra com a planilha de
                  orçamento:{" "}
                  {importa
                    ? "use “Importar orçamento” acima ou "
                    : "peça a quem importa, "}
                  em{" "}
                  <Link
                    href="/operacoes/importacoes"
                    className="font-medium underline underline-offset-4"
                  >
                    Operações › Importações
                  </Link>
                  .
                </p>
              )}
              {estado && <SemDados estado={estado} />}
            </div>
          ) : (
            <p className="py-6 text-sm text-neutral-500">
              Nenhuma obra com estes filtros.
            </p>
          )
        ) : (
          <div data-guia="op-obras-lista" className="flex flex-col gap-4">
            {lista.map((o) => (
              <CartaoObra
                key={o.chave}
                obra={o}
                verOrcamento={verOrc}
                verExecucao={verExec}
                importa={importa}
              />
            ))}
          </div>
        )}
      </Secao>

      {lista.length > 0 && (
        <div className={`grid gap-6 ${verExec ? "xl:grid-cols-2" : ""}`}>
          {verExec && (
            <Secao
              titulo="Avanço físico × prazo consumido"
              descricao="Por obra, na mesma escala. Avanço abaixo do prazo é atraso."
            >
              <AvancoPorPrazo linhas={execLista} />
            </Secao>
          )}
          <Secao
            titulo="Alertas"
            descricao={[
              verExec
                ? `Prazo vencido, desvio abaixo de ${pontos(limite)} (Parâmetros), dia sem relatório e obra paralisada.`
                : null,
              verOrc
                ? "Estouro do orçamento e desembolso abaixo do previsto."
                : null,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <Alertas
              alertas={alertas}
              vazio="Nenhum alerta nas obras filtradas."
            />
          </Secao>
        </div>
      )}

      {estado?.ultimoRelatorioNoApp && (
        <p className="text-xs text-neutral-500">
          Último relatório lançado no aplicativo:{" "}
          {dataHoraDoApp(estado.ultimoRelatorioNoApp)}.{" "}
          <Link
            href={`${BASE_DIARIO}/relatorios`}
            className="font-medium text-neutral-700 underline-offset-4 hover:underline"
          >
            Ver relatórios
          </Link>
        </p>
      )}
    </div>
  );
}

/** Título pequeno acima de uma fileira de cartões. */
function Grupo({
  titulo,
  fonte,
  children,
}: {
  titulo: string;
  fonte: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-neutral-700">
        {titulo} <span className="font-normal text-neutral-500">· {fonte}</span>
      </h2>
      {children}
    </section>
  );
}

const COLUNAS_ORCAMENTO = (mesRef: string): ColunaExportar[] => [
  { titulo: "Revisão" },
  { titulo: "Orçado (R$)", numero: true },
  { titulo: "Realizado (R$)", numero: true },
  { titulo: "Executado (%)", numero: true },
  { titulo: `Previsto até ${rotuloMes(mesRef)} (R$)`, numero: true },
  { titulo: "Índice (realizado ÷ previsto)", numero: true },
  { titulo: "Ritmo" },
  { titulo: "Orçamento" },
];

function colunasExportar(
  verExec: boolean,
  verOrc: boolean,
  mesRef: string,
): ColunaExportar[] {
  return [
    { titulo: "Obra" },
    ...(verExec ? COLUNAS_EXPORTAR.slice(1) : []),
    ...(verOrc ? COLUNAS_ORCAMENTO(mesRef) : []),
  ];
}

function linhaExportar(
  o: ObraDaTela,
  verExec: boolean,
  verOrc: boolean,
): CelulaExportar[] {
  const vazioExec = COLUNAS_EXPORTAR.slice(1).map(() => null);
  const exec = (l: LinhaDoPainel) => linhasExportar([l])[0]?.slice(1) ?? [];
  const i = o.orc?.indicadores;
  return [
    o.orc && !o.orc.ativa ? `${o.nome} (encerrada)` : o.nome,
    ...(verExec ? (o.exec ? exec(o.exec) : vazioExec) : []),
    ...(verOrc
      ? i && o.orc
        ? [
            o.orc.revisao?.codigo ?? "—",
            i.orcado / 100,
            i.realizado / 100,
            i.pctExecutado === null
              ? null
              : Math.round(i.pctExecutado * 10) / 10,
            i.previstoAteMes / 100,
            i.indice === null ? null : Math.round(i.indice * 100) / 100,
            i.ritmo.rotulo,
            i.orcamento.rotulo,
          ]
        : COLUNAS_ORCAMENTO("").map(() => null)
      : []),
  ];
}

const NOMES_DIAS = ["", "seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
function diasQueContam(dias: number[]): string {
  const ordem = [...dias].sort((x, y) => x - y);
  return ordem.map((d) => NOMES_DIAS[d] ?? String(d)).join(", ") || "nenhum";
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <IndicadoresCarregando quantidade={4} />
      <IndicadoresCarregando quantidade={4} />
      <CartaoCarregando altura="h-[28rem]" />
    </TelaCarregando>
  );
}
