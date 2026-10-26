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
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { type FatiaRosca, Rosca } from "@/components/dashboard/graficos";
import {
  CartaoIndicador,
  CartaoPendente,
  SeloIlustrativo,
  SeloStatus,
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
import { CONFIGURACOES_RH } from "@/config/navigation";
import {
  formatarHoras,
  formatarMes,
  formatarMoeda,
  formatarNumero,
  formatarPct,
} from "@/lib/formato";
import { status } from "@/lib/indicadores";
import { competenciasDoPeriodo } from "@/lib/periodo";
import {
  ativosPorGrupo,
  type CustoAgregado,
  custoMedio,
  custosPor,
  somarCustos,
  type TotaisCusto,
} from "@/lib/rh/custo";
import {
  COMPONENTES,
  type ComponenteCusto,
  origemDaParticipacaoDaFolha,
  origemDaReceitaDoGrupo,
  origemDaReceitaPorColaborador,
  origemDoComponente,
  origemDoCustoMedio,
  origemDoCustoTotal,
  origemDoIndiceDeRetorno,
} from "@/lib/rh/modais";
import {
  indiceDeRetorno,
  lancadoOuExemplo,
  participacaoDaFolha,
  receitaDoPeriodo,
  receitaPorColaborador,
  sobreReceita,
} from "@/lib/rh/retorno";
import { ROTULO_CONTRATO } from "@/lib/rh/rubricas";
import { pode } from "@/server/auth";
import {
  type CustoIndividual,
  cargos,
  colaboradoresDoQuadro,
  custoAgregado,
  custosIndividuais,
  dadosFinanceiros,
  faltasDoCusto,
  folhasDoCusto,
  metaDe,
} from "@/server/rh/dados";
import {
  type Busca,
  fimConsiderado,
  lerFiltrosDoPeriodo,
} from "@/server/rh/filtros";
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

  // Folha é mensal: o período usa as folhas dos meses que toca (soma); sem
  // nenhuma, a última folha antes dele.
  const meses = folhas.map((f) => f.competencia).sort();
  const { periodo, hoje, departamento, departamentos } =
    await lerFiltrosDoPeriodo(await busca);
  const doPeriodo = competenciasDoPeriodo(periodo);
  const comFolha = meses.filter((c) => doPeriodo.includes(c));
  const anteriores = meses.filter((c) => c < (doPeriodo[0] as string));
  const usados = comFolha.length ? comFolha : anteriores.slice(-1);
  const filtros = (
    <FiltroPeriodo
      de={periodo.de}
      ate={periodo.ate}
      atalho={periodo.atalho}
      hoje={hoje}
      departamentos={departamentos}
      departamento={departamento}
    />
  );
  if (!usados.length) {
    return (
      <div className="flex flex-col gap-6">
        {filtros}
        <Secao titulo="Sem folha no período">
          <p className="text-sm text-neutral-600">
            Nenhuma folha importada até{" "}
            {formatarMes(doPeriodo.at(-1) as string)}. A primeira é de{" "}
            {formatarMes(meses[0] as string)}.
          </p>
        </Secao>
      </div>
    );
  }
  const mes = usados.at(-1) as string;
  const antes = meses
    .filter((c) => c < (usados[0] as string))
    .slice(-usados.length);
  const rotuloFolhas =
    usados.length === 1
      ? `folha de ${formatarMes(mes)}`
      : `folhas de ${formatarMes(usados[0] as string)} a ${formatarMes(mes)}`;
  const rotuloAntes =
    antes.length === 1
      ? formatarMes(antes[0] as string)
      : `${formatarMes(antes[0] ?? mes)} a ${formatarMes(antes.at(-1) ?? mes)}`;
  const folha = folhas.find((f) => f.competencia === mes);
  const [todas, listaCargos, pessoasTodas, financeiros, metaReceita, quadro] =
    await Promise.all([
      custoAgregado(antes[0] ?? (usados[0] as string), mes),
      cargos(),
      podeIndividual ? custosIndividuais(mes) : Promise.resolve(null),
      dadosFinanceiros(),
      metaDe("rh.custo_sobre_receita", mes),
      colaboradoresDoQuadro(),
    ]);
  const doDep = <T extends { departamento_id: string | null }>(ls: T[]) =>
    departamento ? ls.filter((l) => l.departamento_id === departamento) : ls;
  const linhas = doDep(todas.filter((l) => usados.includes(l.competencia)));
  const linhasAnt =
    antes.length === usados.length
      ? doDep(todas.filter((l) => antes.includes(l.competencia)))
      : [];
  const pessoas = pessoasTodas ? doDep(pessoasTodas) : null;

  // Custo médio = custo ÷ ativos no Copiloto RH no último dia do mês da folha
  // (sócios já ficam fora do quadro). Com vários meses, pessoas-mês: o custo
  // médio sai por pessoa e por mês. Departamento, cargo e contrato do cadastro.
  const fins = usados.map((c) => fimConsiderado(c));
  const quadroDep = doDep(quadro);
  const ativosDe = (
    chave: (c: (typeof quadro)[number]) => string | null | undefined,
  ) => ativosPorGrupo(quadroDep, fins, (c) => chave(c) ?? null);
  const somaDe = (m: Map<string | null, number>) =>
    [...m.values()].reduce((s, n) => s + n, 0);
  const ativosDoFiltro = somaDe(ativosDe(() => "todos"));
  const ativosAntes = somaDe(
    ativosPorGrupo(
      quadroDep,
      antes.map((c) => fimConsiderado(c)),
      () => "todos",
    ),
  );

  const t = somarCustos(linhas);
  const pessoasUltima = somarCustos(
    linhas.filter((l) => l.competencia === mes),
  ).colaboradores;
  const tAnt = linhasAnt.length ? somarCustos(linhasAnt) : null;
  const nomeDep = new Map(departamentos.map((d) => [d.id, d.nome]));
  const nomeCargo = new Map(listaCargos.map((c) => [c.id, c.nome]));
  const comPendencia =
    pessoas?.filter((p) => p.memoria.pendencias.length) ?? [];

  // Receita e custo total da ARP são da empresa inteira, mesmo com
  // departamento no filtro. Sem o faturamento dos meses da folha, um
  // ilustrativo (o último faturamento lançado; sem nenhum, o custo na meta)
  // até ele ser lançado em Cadastros.
  const tArp = somarCustos(todas.filter((l) => usados.includes(l.competencia)));
  const financeiroDe = new Map(financeiros.map((f) => [f.competencia, f]));
  const exemplo = financeiros.find((f) => f.faturamento_bruto);
  const receita = receitaDoPeriodo(
    usados.map((c) => financeiroDe.get(c)?.faturamento_bruto ?? null),
    tArp.custo_total,
    metaReceita?.meta ?? null,
    exemplo?.faturamento_bruto ?? null,
  );
  const seloIlustrativo = receita?.ilustrativa ? (
    <SeloIlustrativo texto="Dados ilustrativos – aguardando faturamento do mês" />
  ) : null;
  const ativos = somaDe(ativosPorGrupo(quadro, fins, () => "todos"));
  const porPessoa = receita
    ? receitaPorColaborador(receita.valor, ativos)
    : null;
  const custoMedioArp = custoMedio(tArp.custo_total, ativos, tArp.sem_valor);
  const medio = custoMedio(t.custo_total, ativosDoFiltro, t.sem_valor);
  const medioAnt = tAnt
    ? custoMedio(tAnt.custo_total, ativosAntes, tAnt.sem_valor)
    : null;
  const indice = indiceDeRetorno(porPessoa, custoMedioArp);
  // Custo + despesa total: o lançado do mês ou, como ilustrativo, o último.
  const exemploCusto = financeiros.find((f) => f.custo_despesa_total);
  const custoDespesa = lancadoOuExemplo(
    usados.map((c) => financeiroDe.get(c)?.custo_despesa_total ?? null),
    exemploCusto?.custo_despesa_total ?? null,
  );
  const participacao = custoDespesa
    ? participacaoDaFolha(t.custo_total, custoDespesa.valor)
    : null;
  const semFaturamento = usados.filter(
    (c) => !financeiroDe.get(c)?.faturamento_bruto,
  );
  const semCustoDespesa = usados.filter(
    (c) => !financeiroDe.get(c)?.custo_despesa_total,
  );
  const opcoesRetorno = {
    competencia: mes,
    ficticia: folha?.ficticia ?? false,
    receita,
    metaPct: metaReceita?.meta ?? null,
    exemploDe: exemplo?.competencia ?? null,
    link: {
      href: `${CONFIGURACOES_RH.cadastros}#financeiro`,
      rotulo: "Abrir Faturamento do mês",
    },
  };
  const daArp = departamento ? " · da ARP inteira" : "";
  const explicaReceita = (grupo: string) =>
    receita
      ? `% sobre a receita = custo do ${grupo} ÷ faturamento bruto total da ARP no mês (${moeda(receita.valor)}${receita.ilustrativa ? ", ilustrativo" : ""}) × 100 · semáforo pela meta de Parâmetros${metaReceita ? ` (até ${formatarPct(metaReceita.meta)})` : ""}`
      : "% sobre a receita: falta o faturamento do mês em Cadastros";

  // O que falta para o custo sair completo: sobe no canto ao abrir a tela.
  const avisos: AvisoDaPagina[] = [
    ...(folha?.ficticia
      ? [
          {
            id: `prototipo-${mes}`,
            tipo: "prototipo" as const,
            titulo: "Valores fictícios",
            texto: `Todo salário da ${rotuloFolhas} foi gravado como R$ 2.000,00. Os totais mostram a conta, não o custo real.`,
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
          texto: `${atual >= ant ? "+" : ""}${formatarNumero(((atual - ant) / ant) * 100, 1)}% vs ${rotuloAntes}`,
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

  const colunasGrupo = (titulo: string): Coluna<Grupo>[] => [
    { titulo, valor: (l) => l.nome },
    {
      titulo: "Pessoas",
      valor: (l) => (
        <span title="Ativos no Copiloto RH no último dia do mês da folha">
          {formatarNumero(l.ativos)}
          {l.totais.sem_valor > 0 && (
            <span className="block text-xs font-normal text-neutral-500">
              {l.totais.sem_valor} sem valor
            </span>
          )}
        </span>
      ),
      numero: true,
    },
    {
      titulo: "% sobre a receita",
      valor: (l) => {
        const pct = receita
          ? sobreReceita(l.totais.custo_total, receita.valor)
          : null;
        if (pct === null) return "—";
        return (
          <AbreDetalhe
            detalhe={origemDaReceitaDoGrupo(
              l.nome,
              l.totais.custo_total,
              pct,
              opcoesRetorno,
            )}
            className="inline-flex items-center justify-end gap-2 rounded-full underline-offset-4 hover:underline"
          >
            {formatarPct(pct)}
            <SeloStatus status={status(pct, metaReceita)} />
          </AbreDetalhe>
        );
      },
      numero: true,
    },
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
      valor: (l) => {
        const m = custoMedio(
          l.totais.custo_total,
          l.ativos,
          l.totais.sem_valor,
        );
        return m === null ? "—" : moeda(m);
      },
      numero: true,
    },
  ];
  const agrupar = (
    chave: (l: CustoAgregado) => string | null,
    ativosDoGrupo: Map<string | null, number>,
    nome: (k: string | null) => string,
  ): Grupo[] =>
    custosPor(linhas, chave).map((g) => ({
      nome: nome(g.chave),
      totais: g.totais,
      ativos: ativosDoGrupo.get(g.chave) ?? 0,
    }));
  const porDepartamento = agrupar(
    (l) => l.departamento_id,
    ativosDe((c) => c.departamento_id),
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
        {filtros}

        <AvisosDaPagina avisos={avisos} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <CartaoIndicador
            titulo="Custo total"
            tom="escuro"
            valor={moeda(t.custo_total)}
            variacao={variacao(t.custo_total, tAnt?.custo_total)}
            detalhe={`${pessoasUltima} pessoas no custo da ${rotuloFolhas}${usados.length > 1 ? " (última) · soma dos meses" : ""}${comFolha.length ? "" : " · sem folha no período: a última antes dele"}`}
            origem={origemDoCustoTotal(t, opcoes)}
          />
          <CartaoIndicador
            titulo="Custo médio por pessoa"
            valor={medio === null ? "—" : moeda(medio)}
            variacao={
              medio !== null && medioAnt !== null
                ? variacao(medio, medioAnt)
                : undefined
            }
            detalhe={`Custo total ÷ colaboradores ativos no Copiloto RH${usados.length > 1 ? " (pessoas-mês)" : ""}`}
            origem={origemDoCustoMedio(t, ativosDoFiltro, opcoes)}
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
              titulo: `Encargos e provisões: ${rotuloFolhas}`,
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
          {receita && porPessoa !== null ? (
            <CartaoIndicador
              titulo="Receita por colaborador"
              valor={moeda(porPessoa)}
              detalhe={`Faturamento bruto ÷ ${formatarNumero(ativos)} ativos no Copiloto RH${usados.length > 1 ? " (pessoas-mês)" : ""}${daArp}`}
              origem={origemDaReceitaPorColaborador(
                porPessoa,
                ativos,
                opcoesRetorno,
              )}
            >
              {seloIlustrativo}
            </CartaoIndicador>
          ) : (
            <CartaoPendente
              titulo="Receita por colaborador"
              motivo={
                receita
                  ? "Nenhum colaborador ativo no Copiloto RH no mês."
                  : `Falta o faturamento de ${semFaturamento.map(formatarMes).join(", ")} (Cadastros > Faturamento do mês) ou a meta de % sobre a receita em Parâmetros.`
              }
              origem={origemDaReceitaPorColaborador(
                null,
                ativos,
                opcoesRetorno,
              )}
            />
          )}
          {indice !== null ? (
            <CartaoIndicador
              titulo="Índice de retorno sobre pessoal"
              valor={formatarMoeda(indice)}
              detalhe={`Cada R$ 1 de folha gera ${formatarMoeda(indice)} de receita · receita por colaborador ÷ custo médio${daArp}`}
              origem={origemDoIndiceDeRetorno(
                indice,
                porPessoa,
                custoMedioArp,
                opcoesRetorno,
              )}
            >
              {seloIlustrativo}
            </CartaoIndicador>
          ) : (
            <CartaoPendente
              titulo="Índice de retorno sobre pessoal"
              motivo="Depende da receita por colaborador e do custo médio."
              origem={origemDoIndiceDeRetorno(
                null,
                porPessoa,
                custoMedioArp,
                opcoesRetorno,
              )}
            />
          )}
          {participacao !== null ? (
            <CartaoIndicador
              titulo="Participação da folha no custo total"
              valor={formatarPct(participacao)}
              detalhe={`Custo de pessoal ÷ custo + despesa total do mês${departamento ? " · só o departamento" : ""}`}
              origem={origemDaParticipacaoDaFolha(
                participacao,
                t.custo_total,
                custoDespesa,
                { ...opcoesRetorno, exemploDe: exemploCusto?.competencia },
              )}
            >
              {custoDespesa?.ilustrativa && (
                <SeloIlustrativo texto="Dados ilustrativos – aguardando faturamento do mês" />
              )}
            </CartaoIndicador>
          ) : (
            <CartaoPendente
              titulo="Participação da folha no custo total"
              motivo={`Falta o custo + despesa total de ${semCustoDespesa.map(formatarMes).join(", ")} (Cadastros > Faturamento do mês).`}
              origem={origemDaParticipacaoDaFolha(
                null,
                t.custo_total,
                null,
                opcoesRetorno,
              )}
            />
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <Secao
            titulo="Composição"
            descricao={`${rotuloFolhas[0]?.toUpperCase()}${rotuloFolhas.slice(1)} · clique numa parte para ver de onde vem`}
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
                ["+ Provisões (13º, férias, recesso, multa)", t.provisoes],
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

        <Secao
          titulo="Por departamento"
          descricao={explicaReceita("departamento")}
        >
          {seloIlustrativo && <div className="mb-3">{seloIlustrativo}</div>}
          <Tabela
            colunas={colunasGrupo("Departamento")}
            linhas={porDepartamento}
            chave={(l) => l.nome}
          />
        </Secao>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Secao
            titulo="Por cargo"
            descricao={explicaReceita("cargo")}
            tom="verde"
            className="flex h-[650px] flex-col"
          >
            <div className="flex h-full flex-col">
              {seloIlustrativo && <div className="mb-3">{seloIlustrativo}</div>}
              <TabelaBusca
                placeholder="Buscar cargo…"
                {...paraBusca(
                  colunasGrupo("Cargo").filter((c) =>
                    [
                      "Cargo",
                      "Pessoas",
                      "Custo total",
                      "Custo médio",
                      "% sobre a receita",
                    ].includes(c.titulo),
                  ),
                  agrupar(
                    (l) => l.cargo_id,
                    ativosDe((c) => c.cargo_id),
                    (k) => (k && nomeCargo.get(k)) || "Sem cargo",
                  ),
                  (l) => l.nome,
                  (l) => l.nome,
                )}
              />
            </div>
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
                  ativosDe((c) => c.tipo_contrato),
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
              descricao={`Custo mensal e por hora na folha de ${formatarMes(mes)}${usados.length > 1 ? " (último mês do período)" : ""}; clique em Ver para a memória de cálculo`}
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
          Estagiário e PJ não têm encargos: o estagiário provisiona só o recesso
          (bolsa ÷ 12) e o PJ, 13º e férias, se marcados em Parâmetros. O custo
          do PJ é o Salário no Copiloto RH. Sócios (pró-labore) ficam fora. Só
          entra quem está no Copiloto RH; desligado, até o mês da rescisão.
          Custo médio = custo ÷ ativos no Copiloto RH no último dia do mês, sem
          os PJ sem valor. Férias e 13º pagos consomem a provisão e não entram
          de novo. O custo é recalculado ao importar a folha, classificar
          rubrica e salvar encargos ou RAT/FAP; folha fechada não muda. A folha
          é mensal: um período dentro do mês mostra o mês inteiro, e vários
          meses são somados (o custo médio é por pessoa e por mês).
        </Nota>
      </div>
    </ProvedorDetalhe>
  );
}

const colunasPessoa: Coluna<CustoIndividual>[] = [
  { titulo: "Colaborador", valor: (p) => p.nome, inteiro: true },
  // "Departamento 4" vira "Dep. 4" para sobrar largura para o nome inteiro;
  // a busca segue pelo nome completo.
  {
    titulo: "Dep.",
    valor: (p) => p.departamento.replace(/^departamento\b/i, "Dep."),
    inteiro: true,
  },
  { titulo: "Cargo", valor: (p) => p.cargo },
  {
    titulo: "Contrato",
    valor: (p) => ROTULO_CONTRATO[p.tipo_contrato] ?? p.tipo_contrato,
  },
  {
    titulo: "Remuneração",
    valor: (p) => (p.valor_informado ? moeda(p.remuneracao) : <SemValor />),
    numero: true,
  },
  { titulo: "Encargos", valor: (p) => moeda(p.encargos), numero: true },
  { titulo: "Provisões", valor: (p) => moeda(p.provisoes), numero: true },
  { titulo: "Benefícios", valor: (p) => moeda(p.beneficios), numero: true },
  {
    titulo: "Custo total",
    valor: (p) => (p.valor_informado ? moeda(p.custo_total) : <SemValor />),
    numero: true,
  },
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
          ? `Ver (${p.memoria.pendencias.length} pend.)`
          : "Ver"}
      </AbreDetalhe>
    ),
    inteiro: true,
  },
];

/** PJ sem Salário no Copiloto RH: fica fora da soma do custo médio. */
function SemValor() {
  return (
    <span
      className="text-xs text-neutral-500 italic"
      title="Preencha o Salário do PJ no Copiloto RH"
    >
      valor não informado
    </span>
  );
}

interface Grupo {
  nome: string;
  totais: TotaisCusto;
  /** Ativos do grupo no Copiloto RH no fim do mês (pessoas-mês). */
  ativos: number;
}

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
      <IndicadoresCarregando quantidade={7} />
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
