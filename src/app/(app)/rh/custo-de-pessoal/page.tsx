import type { Metadata } from "next";
import { Suspense } from "react";
import {
  type AvisoDaPagina,
  AvisosDaPagina,
} from "@/components/avisos-da-pagina";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { Filtros } from "@/components/dashboard/filtros";
import { type FatiaRosca, Rosca } from "@/components/dashboard/graficos";
import {
  CartaoIndicador,
  type Variacao,
} from "@/components/dashboard/indicador";
import {
  type Coluna,
  Nota,
  paraBusca,
  Secao,
  Tabela,
} from "@/components/dashboard/tabela";
import { TabelaBusca } from "@/components/dashboard/tabela-busca";
import { FormAcao } from "@/components/form-acao";
import {
  AbreDetalhe,
  type Detalhe,
  ProvedorDetalhe,
} from "@/components/modal-detalhe";
import { EmConstrucao, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import {
  formatarHoras,
  formatarMes,
  formatarMoeda,
  formatarNumero,
  formatarPct,
} from "@/lib/formato";
import {
  type CustoAgregado,
  custosPor,
  somarCustos,
  type TotaisCusto,
} from "@/lib/rh/custo";
import {
  COMPONENTES,
  type ComponenteCusto,
  origemDoComponente,
  origemDoCustoMedio,
  origemDoCustoTotal,
} from "@/lib/rh/modais";
import { ROTULO_CONTRATO } from "@/lib/rh/rubricas";
import { pode } from "@/server/auth";
import {
  type CustoIndividual,
  cargos,
  custoAgregado,
  custosIndividuais,
  faltasDoCusto,
  folhasDoCusto,
} from "@/server/rh/dados";
import { type Busca, lerFiltros, mesAnterior } from "@/server/rh/filtros";
import { recalcularCustos } from "./actions";

export const metadata: Metadata = { title: "Custo de pessoal" };

export default function Page({
  searchParams,
}: PageProps<"/rh/custo-de-pessoal">) {
  return (
    <>
      <PageHeader
        title="Custo de pessoal"
        description="Composição do custo (remuneração, encargos, provisões e benefícios), por departamento e cargo, e tabela por funcionário com custo mensal, custo por hora e memória de cálculo."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="rh.custo_pessoal">
          <Custo busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

const moeda = (v: number) => formatarMoeda(v, 0);

async function Custo({ busca }: { busca: Promise<Busca> }) {
  const folhas = await folhasDoCusto();
  const [podeRecalcular, podeIndividual, faltas] = await Promise.all([
    pode("rh.folha").then(async (p) => p || pode("rh.parametros")),
    pode("rh.custo_pessoal.individual"),
    faltasDoCusto(),
  ]);
  if (!folhas.length) {
    return (
      <EmConstrucao motivo="Nenhuma folha importada ainda. Importe o Extrato Mensal em Importar folha: o custo é calculado na hora." />
    );
  }

  const meses = folhas.map((f) => f.competencia);
  const { mes, departamento, departamentos } = await lerFiltros(
    await busca,
    meses,
  );
  const folha = folhas.find((f) => f.competencia === mes);
  const anterior = meses.find((m) => m < mes) ?? mesAnterior(mes);
  const [todas, listaCargos, pessoasTodas] = await Promise.all([
    custoAgregado(anterior, mes),
    cargos(),
    podeIndividual ? custosIndividuais(mes) : Promise.resolve(null),
  ]);
  const doDep = <T extends { departamento_id: string | null }>(ls: T[]) =>
    departamento ? ls.filter((l) => l.departamento_id === departamento) : ls;
  const linhas = doDep(todas.filter((l) => l.competencia === mes));
  const linhasAnt = doDep(todas.filter((l) => l.competencia === anterior));
  const pessoas = pessoasTodas ? doDep(pessoasTodas) : null;

  const t = somarCustos(linhas);
  const tAnt = linhasAnt.length ? somarCustos(linhasAnt) : null;
  const nomeDep = new Map(departamentos.map((d) => [d.id, d.nome]));
  const nomeCargo = new Map(listaCargos.map((c) => [c.id, c.nome]));
  const comPendencia =
    pessoas?.filter((p) => p.memoria.pendencias.length) ?? [];

  // O que falta para o custo sair completo: sobe no canto ao abrir a tela.
  const avisos: AvisoDaPagina[] = [
    ...(folha?.ficticia
      ? [
          {
            id: `prototipo-${mes}`,
            tipo: "prototipo" as const,
            titulo: "Valores fictícios",
            texto: `Todo salário da folha de ${formatarMes(mes)} foi gravado como R$ 2.000,00. Os totais mostram a conta, não o custo real.`,
          },
        ]
      : []),
    ...faltas,
    ...(comPendencia.length > 0
      ? [
          {
            id: `pendencias-${mes}`,
            tipo: "info" as const,
            titulo: `${comPendencia.length} ${comPendencia.length > 1 ? "pessoas" : "pessoa"} com pendência`,
            texto:
              "Algo ficou fora da conta delas. A coluna Memória mostra o quê.",
            acao: { href: "#por-funcionario", rotulo: "Ver na tabela" },
          },
        ]
      : []),
  ];

  const variacao = (
    atual: number,
    ant: number | undefined,
  ): Variacao | undefined =>
    ant
      ? {
          texto: `${atual >= ant ? "+" : ""}${formatarNumero(((atual - ant) / ant) * 100, 1)}% vs ${formatarMes(anterior)}`,
          sentido: "neutro",
        }
      : undefined;

  const partes: ComponenteCusto[] = [
    "remuneracao",
    "encargos",
    "provisoes",
    "beneficios",
    "rescisao",
  ];
  const fatias: FatiaRosca[] = partes.map((c, i) => ({
    chave: c,
    rotulo: COMPONENTES[c].rotulo,
    valor: t[c],
    texto: moeda(t[c]),
    cor: (i + 1) as FatiaRosca["cor"],
  }));

  const colunasGrupo = (
    titulo: string,
  ): Coluna<{ nome: string; totais: TotaisCusto }>[] => [
    { titulo, valor: (l) => l.nome },
    { titulo: "Pessoas", valor: (l) => l.totais.colaboradores, numero: true },
    {
      titulo: "Remuneração",
      valor: (l) => moeda(l.totais.remuneracao),
      numero: true,
    },
    {
      titulo: "Encargos",
      valor: (l) => moeda(l.totais.encargos),
      numero: true,
    },
    {
      titulo: "Provisões",
      valor: (l) => moeda(l.totais.provisoes),
      numero: true,
    },
    {
      titulo: "Benefícios",
      valor: (l) => moeda(l.totais.beneficios),
      numero: true,
    },
    {
      titulo: "Rescisões",
      valor: (l) => moeda(l.totais.rescisao),
      numero: true,
    },
    {
      titulo: "Custo total",
      valor: (l) => moeda(l.totais.custo_total),
      numero: true,
    },
    {
      titulo: "Custo médio",
      valor: (l) => moeda(l.totais.custo_total / l.totais.colaboradores),
      numero: true,
    },
  ];
  const agrupar = (
    chave: (l: CustoAgregado) => string | null,
    nome: (k: string | null) => string,
  ) =>
    custosPor(linhas, chave).map((g) => ({
      nome: nome(g.chave),
      totais: g.totais,
    }));
  const porDepartamento = agrupar(
    (l) => l.departamento_id,
    (k) => (k && nomeDep.get(k)) || "Sem departamento",
  );

  // De onde vem cada número (modal ao clicar).
  const opcoes = {
    competencia: mes,
    ficticia: folha?.ficticia ?? false,
    porSetor: porDepartamento,
    pessoas,
  };
  const origemDe = Object.fromEntries(
    partes.map((c) => [c, origemDoComponente(c, t, opcoes)]),
  ) as Record<ComponenteCusto, Detalhe>;

  return (
    <ProvedorDetalhe>
      <div className="flex flex-col gap-6">
        <Filtros
          meses={meses}
          mes={mes}
          departamentos={departamentos}
          departamento={departamento}
        />

        <AvisosDaPagina avisos={avisos} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <CartaoIndicador
            titulo="Custo total"
            tom="escuro"
            valor={moeda(t.custo_total)}
            variacao={variacao(t.custo_total, tAnt?.custo_total)}
            detalhe={`${t.colaboradores} pessoas na folha de ${formatarMes(mes)}`}
            origem={origemDoCustoTotal(t, opcoes)}
          />
          <CartaoIndicador
            titulo="Custo médio por pessoa"
            valor={
              t.colaboradores ? moeda(t.custo_total / t.colaboradores) : "—"
            }
            variacao={
              tAnt?.colaboradores && t.colaboradores
                ? variacao(
                    t.custo_total / t.colaboradores,
                    tAnt.custo_total / tAnt.colaboradores,
                  )
                : undefined
            }
            detalhe="Custo total ÷ pessoas na folha"
            origem={origemDoCustoMedio(t, opcoes)}
          />
          <CartaoIndicador
            titulo="Encargos e provisões"
            valor={moeda(t.encargos + t.provisoes)}
            detalhe={
              t.remuneracao
                ? `${formatarPct(((t.encargos + t.provisoes) / t.remuneracao) * 100)} da remuneração`
                : undefined
            }
            origem={{
              ...origemDe.encargos,
              titulo: `Encargos e provisões de ${formatarMes(mes)}`,
              fontes: [
                ...(origemDe.encargos.fontes ?? []),
                { rotulo: "Provisões", valor: COMPONENTES.provisoes.regra },
              ],
              tabelas: [
                ...origemDe.encargos.tabelas.map((tb) => ({
                  ...tb,
                  titulo: `Encargos · ${tb.titulo?.toLowerCase()}`,
                })),
                ...origemDe.provisoes.tabelas.map((tb) => ({
                  ...tb,
                  titulo: `Provisões · ${tb.titulo?.toLowerCase()}`,
                })),
              ],
            }}
          />
          <CartaoIndicador
            titulo="Benefícios"
            tom="verde"
            valor={moeda(t.beneficios)}
            detalhe="Valor do benefício − o que o funcionário paga"
            origem={origemDe.beneficios}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <Secao
            titulo="Composição"
            descricao={`${formatarMes(mes)} · clique numa parte para ver de onde vem`}
            className="xl:col-span-3"
          >
            <Rosca
              fatias={fatias}
              descricao="Composição do custo de pessoal"
              centro={{ valor: moeda(t.custo_total), rotulo: "custo total" }}
              detalhes={origemDe}
            />
          </Secao>
          <Secao
            titulo="Da remuneração ao custo"
            tom="escuro"
            descricao="Cada degrau soma uma parte"
            className="xl:col-span-2"
          >
            <dl className="flex flex-col divide-y divide-neutral-900/[0.06] text-sm">
              {[
                ["Remuneração", t.remuneracao],
                ["+ Rescisões", t.rescisao],
                ["+ Encargos", t.encargos],
                ["+ Provisões (13º, férias, multa)", t.provisoes],
                ["+ Benefícios", t.beneficios],
              ].map(([rotulo, valor]) => (
                <div key={rotulo} className="flex justify-between gap-4 py-2">
                  <dt className="text-neutral-600">{rotulo}</dt>
                  <dd className="tabular-nums">{moeda(valor as number)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 py-2 font-semibold">
                <dt>= Custo total</dt>
                <dd className="tabular-nums">{moeda(t.custo_total)}</dd>
              </div>
            </dl>
          </Secao>
        </div>

        <Secao titulo="Por departamento">
          <Tabela
            colunas={colunasGrupo("Departamento")}
            linhas={porDepartamento}
            chave={(l) => l.nome}
          />
        </Secao>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Secao
            titulo="Por cargo"
            tom="verde"
            className="flex h-[650px] flex-col"
          >
            <TabelaBusca
              placeholder="Buscar cargo…"
              {...paraBusca(
                colunasGrupo("Cargo").filter((c) =>
                  ["Cargo", "Pessoas", "Custo total", "Custo médio"].includes(
                    c.titulo,
                  ),
                ),
                agrupar(
                  (l) => l.cargo_id,
                  (k) => (k && nomeCargo.get(k)) || "Sem cargo",
                ),
                (l) => l.nome,
                (l) => l.nome,
              )}
            />
          </Secao>
          <Secao
            titulo="Por tipo de contrato"
            className="flex h-[650px] flex-col"
          >
            <TabelaBusca
              placeholder="Buscar contrato…"
              {...paraBusca(
                colunasGrupo("Contrato").filter((c) =>
                  [
                    "Contrato",
                    "Pessoas",
                    "Custo total",
                    "Custo médio",
                  ].includes(c.titulo),
                ),
                agrupar(
                  (l) => l.tipo_contrato,
                  (k) => (k && ROTULO_CONTRATO[k]) || "—",
                ),
                (l) => l.nome,
                (l) => l.nome,
              )}
            />
          </Secao>
        </div>

        {pessoas && (
          <div id="por-funcionario" className="scroll-mt-6">
            <Secao
              titulo="Por funcionário"
              descricao="Custo mensal e por hora; clique em Ver para a memória de cálculo"
              className="flex h-[650px] flex-col"
            >
              <TabelaBusca
                placeholder="Buscar pelo nome, departamento ou cargo…"
                {...paraBusca(
                  colunasPessoa,
                  [...pessoas].sort((a, b) => b.custo_total - a.custo_total),
                  (p) => p.colaborador_id,
                  (p) => `${p.nome} ${p.departamento} ${p.cargo}`,
                )}
                rodape={[
                  "Total",
                  "",
                  "",
                  "",
                  moeda(t.remuneracao),
                  moeda(t.encargos),
                  moeda(t.provisoes),
                  moeda(t.beneficios),
                  moeda(t.custo_total),
                  "",
                  "",
                ]}
              />
            </Secao>
          </div>
        )}

        {podeRecalcular && (
          <FormAcao
            acao={recalcularCustos}
            rotulo="Recalcular custo"
            rotuloEnviando="Recalculando…"
            variante="secundario"
          />
        )}

        <Nota>
          Cálculo da especificação do RH (4.4): encargos = remuneração × (INSS +
          Terceiros + FGTS + RAT × FAP); provisões de 13º (÷ 12) e férias (÷ 12
          × 4/3) com todos os encargos; multa rescisória = % do FGTS do mês.
          Férias e 13º pagos consomem a provisão e não entram de novo. O custo é
          recalculado ao importar a folha, classificar rubrica e salvar encargos
          ou RAT/FAP; folha fechada não muda.
        </Nota>
      </div>
    </ProvedorDetalhe>
  );
}

const colunasPessoa: Coluna<CustoIndividual>[] = [
  { titulo: "Colaborador", valor: (p) => p.nome },
  { titulo: "Departamento", valor: (p) => p.departamento },
  { titulo: "Cargo", valor: (p) => p.cargo },
  {
    titulo: "Contrato",
    valor: (p) => ROTULO_CONTRATO[p.tipo_contrato] ?? p.tipo_contrato,
  },
  { titulo: "Remuneração", valor: (p) => moeda(p.remuneracao), numero: true },
  { titulo: "Encargos", valor: (p) => moeda(p.encargos), numero: true },
  { titulo: "Provisões", valor: (p) => moeda(p.provisoes), numero: true },
  { titulo: "Benefícios", valor: (p) => moeda(p.beneficios), numero: true },
  { titulo: "Custo total", valor: (p) => moeda(p.custo_total), numero: true },
  {
    titulo: "Custo/hora",
    valor: (p) => (p.custo_hora === null ? "—" : formatarMoeda(p.custo_hora)),
    numero: true,
  },
  {
    titulo: "Memória",
    valor: (p) => (
      <AbreDetalhe
        detalhe={memoria(p)}
        className="rounded-full px-2 py-0.5 text-xs font-medium underline-offset-4 hover:underline"
      >
        {p.memoria.pendencias.length
          ? `Ver (${p.memoria.pendencias.length} pendência${p.memoria.pendencias.length > 1 ? "s" : ""})`
          : "Ver"}
      </AbreDetalhe>
    ),
  },
];

function memoria(p: CustoIndividual): Detalhe {
  return {
    secao: "Memória de cálculo",
    titulo: p.nome,
    subtitulo: `${p.cargo} · ${p.departamento} · ${ROTULO_CONTRATO[p.tipo_contrato] ?? p.tipo_contrato}`,
    resumo: [
      { rotulo: "Custo total", valor: formatarMoeda(p.custo_total) },
      {
        rotulo: "Custo por hora",
        valor: p.custo_hora === null ? "—" : formatarMoeda(p.custo_hora),
      },
      {
        rotulo: "Salário por hora",
        valor: p.salario_hora === null ? "—" : formatarMoeda(p.salario_hora),
      },
      {
        rotulo: "Jornada",
        valor: p.jornada_min === null ? "—" : formatarHoras(p.jornada_min),
      },
    ],
    tabelas: [
      {
        titulo: "Cada linha da conta",
        colunas: [
          { titulo: "Linha" },
          { titulo: "Valor", numero: true },
          { titulo: "Regra" },
        ],
        linhas: p.memoria.linhas.map((l, i) => ({
          chave: `${i}`,
          celulas: [l.rotulo, formatarMoeda(l.valor), l.regra],
          ordem: [i, l.valor, l.regra],
        })),
      },
      ...(p.memoria.pendencias.length
        ? [
            {
              titulo: "Pendências",
              colunas: [{ titulo: "O que ficou de fora" }],
              linhas: p.memoria.pendencias.map((t, i) => ({
                chave: `${i}`,
                celulas: [t],
              })),
            },
          ]
        : []),
    ],
  };
}

/** Blocos no lugar dos cartões da tela enquanto os dados chegam. */
function Esqueleto() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <IndicadoresCarregando quantidade={4} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <CartaoCarregando className="xl:col-span-3" altura="h-80" />
        <CartaoCarregando className="xl:col-span-2" altura="h-80" />
      </div>
      <CartaoCarregando />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CartaoCarregando altura="h-[650px]" />
        <CartaoCarregando altura="h-[650px]" />
      </div>
      <CartaoCarregando altura="h-[650px]" />
    </TelaCarregando>
  );
}
