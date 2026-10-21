import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { Filtros } from "@/components/dashboard/filtros";
import { BarrasHorizontais, Colunas } from "@/components/dashboard/graficos";
import {
  CartaoIndicador,
  CartaoPendente,
  SeloStatus,
  type Variacao,
} from "@/components/dashboard/indicador";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { AbreDetalhe, ProvedorDetalhe } from "@/components/modal-detalhe";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import {
  formatarData,
  formatarHoras,
  formatarMes,
  formatarMoeda,
  formatarNumero,
  formatarPct,
  ultimasCompetencias,
} from "@/lib/formato";
import { status } from "@/lib/indicadores";
import {
  ativosEm,
  movimentoDoMes,
  porSetor,
  somarPonto,
} from "@/lib/rh/calculos";
import { custosPor, somarCustos } from "@/lib/rh/custo";
import {
  type FocoQuadro,
  origemDoAbsenteismo,
  origemDoBanco,
  origemDoCustoSobreReceita,
  origemDoCustoTotal,
  origemDoQuadro,
  origemDoSetor,
} from "@/lib/rh/modais";
import { pode } from "@/server/auth";
import {
  type BancoEmReais,
  bancoHorasEmReais,
  colaboradoresDoQuadro,
  competenciasDoPonto,
  configTurnover,
  custoAgregado,
  custosIndividuais,
  faturamentoDe,
  folhasDoCusto,
  metaDe,
  pontoDoMes,
} from "@/server/rh/dados";
import {
  type Busca,
  fimConsiderado,
  lerFiltros,
  mesAnterior,
} from "@/server/rh/filtros";

export const metadata: Metadata = { title: "Painel de RH" };

export default function Page({ searchParams }: PageProps<"/rh">) {
  return (
    <>
      <PageHeader
        title="Painel de RH"
        description="Indicadores de pessoal do mês, com semáforo pela meta configurada em Parâmetros."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="rh.painel">
          <Painel busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

function variacaoPp(
  atual: number | null,
  anterior: number | null,
  mes: string,
): Variacao | undefined {
  if (atual === null || anterior === null) return undefined;
  const d = atual - anterior;
  return {
    texto: `${d > 0 ? "+" : ""}${formatarNumero(d, 1)} p.p. vs ${formatarMes(mes)}`,
    sentido: Math.abs(d) < 0.05 ? "neutro" : d < 0 ? "bom" : "ruim",
  };
}

async function Painel({ busca }: { busca: Promise<Busca> }) {
  const meses = await competenciasDoPonto();
  const { mes, departamento, departamentos } = await lerFiltros(
    await busca,
    meses,
  );
  const anterior = mesAnterior(mes);
  const doDep = <T extends { departamento_id: string | null }>(ls: T[]) =>
    departamento ? ls.filter((l) => l.departamento_id === departamento) : ls;

  const [
    ponto,
    pontoAnt,
    todos,
    metaAbs,
    metaBanco,
    metaCusto,
    metaTurnover,
    custo,
    veJornada,
    veQuadro,
    turnover,
  ] = await Promise.all([
    pontoDoMes(mes).then(doDep),
    pontoDoMes(anterior).then(doDep),
    colaboradoresDoQuadro().then(doDep),
    metaDe("rh.absenteismo", mes),
    metaDe("rh.banco_horas_positivo", mes),
    metaDe("rh.custo_sobre_receita", mes),
    metaDe("rh.turnover", mes),
    custoDoPainel(
      mes,
      departamento,
      new Map(departamentos.map((d) => [d.id, d.nome])),
    ),
    // Lista de pessoas no modal só para quem já as vê nas telas do RH.
    pode("rh.jornada"),
    pode("rh.quadro"),
    configTurnover(),
  ]);

  const totais = somarPonto(ponto);
  const totaisAnt = pontoAnt.length ? somarPonto(pontoAnt) : null;
  const ate = fimConsiderado(mes);
  const ativos = ativosEm(todos, ate).length;
  const ativosAnt = ativosEm(todos, fimConsiderado(anterior)).length;
  const movimento = movimentoDoMes(todos, mes, turnover);
  const evolucao = ultimasCompetencias(mes, 12).map((c) => {
    const n = ativosEm(todos, fimConsiderado(c)).length;
    return {
      chave: c,
      rotulo: formatarMes(c).slice(0, 3),
      titulo: formatarMes(c),
      valor: n,
      texto: String(n),
      detalhe: "colaboradores ativos no fim do mês",
      destaque: c === mes,
    };
  });
  const setores = porSetor(ponto);
  const bancoHoras = totais.banco_positivo_min / 60;
  const banco = custo.banco;
  const bancoValor =
    banco && departamento
      ? (banco.porDepartamento.get(departamento) ?? null)
      : (banco?.valor ?? null);

  // De onde vem cada número (modal ao clicar).
  const comDep = departamento ? `&dep=${departamento}` : "";
  const linkJornada = (dep = departamento) => ({
    href: `/rh/jornada?mes=${mes.slice(0, 7)}${dep ? `&dep=${dep}` : ""}`,
    rotulo: "Abrir a Jornada",
  });
  const opcoesPonto = {
    mes,
    ate,
    pessoas: veJornada,
    link: veJornada ? linkJornada() : undefined,
  };
  const quadroDoMes = (foco: FocoQuadro, c = mes) =>
    origemDoQuadro(todos, c, fimConsiderado(c), {
      foco,
      pessoas: veQuadro,
      turnover,
      link: veQuadro
        ? {
            href: `/rh/quadro?mes=${c.slice(0, 7)}${comDep}`,
            rotulo: "Abrir Quadro e turnover",
          }
        : undefined,
    });
  const linkCusto = custo.competencia
    ? {
        href: `/rh/custo-de-pessoal?mes=${custo.competencia.slice(0, 7)}${comDep}`,
        rotulo: "Abrir Custo de pessoal",
      }
    : undefined;
  const origemReceita = custo.podeVer
    ? origemDoCustoSobreReceita(custo.totais, custo.faturamento, {
        competencia: custo.competencia ?? mes,
        ficticia: custo.ficticia,
        meta: metaCusto ? `até ${formatarPct(metaCusto.meta)}` : undefined,
        link: linkCusto,
      })
    : undefined;

  return (
    <ProvedorDetalhe>
      <div className="flex flex-col gap-6">
        <Filtros
          meses={meses}
          mes={mes}
          departamentos={departamentos}
          departamento={departamento}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {custo.totais && custo.sobreReceita !== null ? (
            <CartaoIndicador
              titulo="Custo de pessoal sobre a receita"
              valor={formatarPct(custo.sobreReceita)}
              status={status(custo.sobreReceita, metaCusto)}
              meta={
                metaCusto
                  ? `Meta: até ${formatarPct(metaCusto.meta)}`
                  : "Defina a meta em Parâmetros"
              }
              detalhe={`Folha de ${formatarMes(custo.competencia ?? mes)} ÷ faturamento bruto`}
              origem={origemReceita}
            />
          ) : (
            <CartaoPendente
              titulo="Custo de pessoal sobre a receita"
              motivo={
                custo.totais && custo.competencia
                  ? `Falta o faturamento de ${formatarMes(custo.competencia)} (vem do ENET).`
                  : custo.motivo
              }
              meta={
                metaCusto
                  ? `Meta: até ${formatarPct(metaCusto.meta)}`
                  : undefined
              }
              origem={origemReceita}
            />
          )}
          {custo.totais && custo.competencia ? (
            <CartaoIndicador
              titulo="Custo total de pessoal"
              tom="escuro"
              valor={formatarMoeda(custo.totais.custo_total, 0)}
              serie={custo.serie}
              variacao={custo.variacao}
              detalhe={`${custo.competencia === mes ? "Folha" : "Última folha"}: ${formatarMes(custo.competencia)} · ${custo.totais.colaboradores} pessoas${custo.ficticia ? " · salários fictícios (protótipo)" : ""}`}
              meta={`Remuneração ${formatarMoeda(custo.totais.remuneracao, 0)} · + encargos e provisões ${formatarMoeda(custo.totais.encargos + custo.totais.provisoes, 0)}`}
              origem={origemDoCustoTotal(custo.totais, {
                competencia: custo.competencia,
                ficticia: custo.ficticia,
                porSetor: custo.porSetor,
                pessoas: custo.pessoas,
                link: linkCusto,
              })}
            />
          ) : (
            <CartaoPendente
              titulo="Custo total de pessoal"
              motivo={custo.motivo}
            />
          )}
          <CartaoIndicador
            titulo="Headcount"
            valor={formatarNumero(ativos)}
            detalhe={`Cadastro do ponto em ${formatarData(ate)}`}
            serie={evolucao}
            variacao={{
              texto: `${ativos - ativosAnt >= 0 ? "+" : ""}${ativos - ativosAnt} vs ${formatarMes(anterior)}`,
              sentido: "neutro",
            }}
            origem={quadroDoMes("ativos")}
          />
          <CartaoIndicador
            titulo="Absenteísmo"
            tom="verde"
            valor={formatarPct(totais.absenteismo)}
            status={status(totais.absenteismo, metaAbs)}
            meta={
              metaAbs
                ? `Meta: até ${formatarPct(metaAbs.meta)}`
                : "Defina a meta em Parâmetros"
            }
            variacao={variacaoPp(
              totais.absenteismo,
              totaisAnt?.absenteismo ?? null,
              anterior,
            )}
            detalhe="Faltas e atrasos ÷ horas previstas"
            origem={origemDoAbsenteismo(ponto, {
              ...opcoesPonto,
              meta: metaAbs ? `até ${formatarPct(metaAbs.meta)}` : undefined,
            })}
          />
          <CartaoIndicador
            titulo="Banco de horas positivo"
            valor={formatarHoras(totais.banco_positivo_min)}
            status={status(ponto.length ? bancoHoras : null, metaBanco)}
            meta={
              metaBanco
                ? `Meta: até ${formatarNumero(metaBanco.meta)}h`
                : "Defina a meta em Parâmetros"
            }
            detalhe={`Saldo líquido ${formatarHoras(totais.banco_saldo_min)} · ${textoBancoEmReais(banco, bancoValor, custo.podeVer)}`}
            origem={origemDoBanco(ponto, {
              ...opcoesPonto,
              soPositivo: true,
              reais: custo.podeVer ? banco : null,
              meta: metaBanco
                ? `até ${formatarNumero(metaBanco.meta)}h`
                : undefined,
            })}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Secao
            titulo="Evolução do headcount"
            descricao="Colaboradores ativos no fim de cada mês (cadastro do ponto)"
            className="lg:col-span-2"
          >
            <Colunas
              itens={evolucao}
              descricao="Colaboradores ativos no fim de cada mês, últimos 12 meses"
              detalhes={Object.fromEntries(
                evolucao.map((e) => [e.chave, quadroDoMes("ativos", e.chave)]),
              )}
            />
          </Secao>

          <Secao tom="escuro" titulo={`Movimento de ${formatarMes(mes)}`}>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <AbreDetalhe
                detalhe={quadroDoMes("admissoes")}
                className="-m-2 rounded-2xl p-2 hover:bg-white/50"
              >
                <p className="text-neutral-500">Admissões</p>
                <p className="text-2xl font-semibold">{movimento.admissoes}</p>
              </AbreDetalhe>
              <AbreDetalhe
                detalhe={quadroDoMes("desligamentos")}
                className="-m-2 rounded-2xl p-2 hover:bg-white/50"
              >
                <p className="text-neutral-500">Desligamentos</p>
                <p className="text-2xl font-semibold">
                  {movimento.desligamentos}
                </p>
              </AbreDetalhe>
              <AbreDetalhe
                detalhe={quadroDoMes("turnover")}
                className="col-span-2 -m-2 mt-2 rounded-2xl p-2 hover:bg-white/50"
              >
                <p className="text-neutral-500">Turnover</p>
                <p className="mt-1 flex items-center gap-3">
                  <span className="text-2xl font-semibold">
                    {formatarPct(movimento.turnover)}
                  </span>
                  <SeloStatus
                    status={status(movimento.turnover, metaTurnover)}
                  />
                </p>
              </AbreDetalhe>
            </div>
            <p className="mt-4 text-xs text-neutral-500">
              {movimento.taxas
                .slice(1)
                .map(
                  (t) =>
                    `${t.rotulo.replace("Turnover ", "")}: ${formatarPct(t.valor)}`,
                )
                .join(" · ")}
            </p>
            <Link
              href={`/rh/quadro?mes=${mes.slice(0, 7)}`}
              className="mt-4 inline-block text-sm font-medium underline-offset-4 hover:underline"
            >
              Ver quadro e turnover →
            </Link>
          </Secao>
        </div>

        <Secao
          titulo="Absenteísmo por setor"
          descricao={`${formatarMes(mes)} · faltas e atrasos ÷ horas previstas`}
        >
          <BarrasHorizontais
            descricao="Absenteísmo por setor"
            meta={
              metaAbs
                ? {
                    valor: metaAbs.meta,
                    texto: `Meta: até ${formatarPct(metaAbs.meta)}`,
                  }
                : undefined
            }
            itens={setores.map((s) => ({
              chave: s.departamento_id ?? "sem",
              rotulo: s.departamento,
              valor: s.absenteismo ?? 0,
              texto: formatarPct(s.absenteismo),
              detalhe: `${s.colaboradores} pessoas · faltas ${formatarHoras(s.faltas_min)} · atrasos ${formatarHoras(s.atrasos_min)}`,
            }))}
            detalhes={Object.fromEntries(
              setores.map((s) => [
                s.departamento_id ?? "sem",
                origemDoSetor(
                  s,
                  ponto.filter((l) => l.departamento_id === s.departamento_id),
                  {
                    ...opcoesPonto,
                    link: veJornada
                      ? linkJornada(s.departamento_id)
                      : undefined,
                  },
                ),
              ]),
            )}
          />
          <Link
            href={linkJornada().href}
            className="mt-4 inline-block text-sm font-medium underline-offset-4 hover:underline"
          >
            Ver jornada por funcionário →
          </Link>
        </Secao>

        <Nota>
          Fonte: ponto (Secullum) de {formatarData(mes)} a {formatarData(ate)},
          sincronizado todo dia. Custo: última folha importada até o mês, com
          encargos, provisões e benefícios dos Parâmetros.
        </Nota>
      </div>
    </ProvedorDetalhe>
  );
}

/** Custo da folha do mês, ou da última folha anterior, no recorte do filtro. */
async function custoDoPainel(
  mes: string,
  departamento: string | null,
  nomes: Map<string, string>,
) {
  const [podeVer, individual] = await Promise.all([
    pode("rh.custo_pessoal"),
    pode("rh.custo_pessoal.individual"),
  ]);
  const vazio = {
    podeVer,
    totais: null,
    competencia: null,
    ficticia: false,
    porSetor: [],
    pessoas: null,
    serie: undefined,
    variacao: undefined,
    sobreReceita: null,
    faturamento: null,
    banco: null,
  };
  if (!podeVer) return { ...vazio, motivo: "Sem acesso ao custo de pessoal." };

  const janela = ultimasCompetencias(mes, 12);
  const [todas, folhas, banco] = await Promise.all([
    custoAgregado(janela[0] as string, mes),
    folhasDoCusto(),
    bancoHorasEmReais(mes),
  ]);
  const linhas = departamento
    ? todas.filter((l) => l.departamento_id === departamento)
    : todas;
  const meses = [...new Set(linhas.map((l) => l.competencia))].sort();
  const competencia = meses.at(-1) ?? null;
  if (!competencia)
    return {
      ...vazio,
      banco,
      motivo: folhas.length
        ? "Custo ainda não calculado: use Recalcular em Custo de pessoal."
        : "Depende da importação da folha.",
    };

  const doMes = (c: string) =>
    somarCustos(linhas.filter((l) => l.competencia === c));
  const totais = doMes(competencia);
  const anterior = meses.at(-2);
  const totalAnt = anterior ? doMes(anterior).custo_total : null;
  const [faturamento, pessoas] = await Promise.all([
    departamento ? null : faturamentoDe(competencia),
    individual ? custosIndividuais(competencia) : null,
  ]);
  const variacao: Variacao | undefined =
    totalAnt && anterior
      ? {
          texto: `${totais.custo_total >= totalAnt ? "+" : ""}${formatarNumero(((totais.custo_total - totalAnt) / totalAnt) * 100, 1)}% vs ${formatarMes(anterior)}`,
          sentido: "neutro",
        }
      : undefined;
  return {
    podeVer,
    motivo: "",
    totais,
    competencia,
    ficticia:
      folhas.find((f) => f.competencia === competencia)?.ficticia ?? false,
    porSetor: custosPor(
      linhas.filter((l) => l.competencia === competencia),
      (l) => l.departamento_id,
    ).map((g) => ({
      nome: (g.chave && nomes.get(g.chave)) || "Sem departamento",
      totais: g.totais,
    })),
    pessoas:
      pessoas && departamento
        ? pessoas.filter((p) => p.departamento_id === departamento)
        : pessoas,
    faturamento,
    serie: meses.map((c) => {
      const t = doMes(c).custo_total;
      return {
        chave: c,
        rotulo: formatarMes(c).slice(0, 3),
        titulo: formatarMes(c),
        valor: t,
        texto: formatarMoeda(t, 0),
        destaque: c === competencia,
      };
    }),
    variacao,
    // Por departamento não há receita: o % é só da empresa.
    sobreReceita:
      faturamento && faturamento > 0
        ? (totais.custo_total / faturamento) * 100
        : null,
    banco,
  };
}

function textoBancoEmReais(
  banco: BancoEmReais | null,
  valor: number | null,
  podeVer: boolean,
): string {
  if (!podeVer) return "valor em R$ só com acesso ao custo";
  if (!banco?.folha) return "valor em R$ depende da folha";
  if (banco.adicional === null)
    return "valor em R$: configure o banco de horas em Parâmetros";
  return `≈ ${formatarMoeda(valor ?? 0, 0)} a pagar (salário/hora de ${formatarMes(banco.folha)}, +${formatarNumero(banco.adicional)}%)${banco.semSalario ? ` · ${banco.semSalario} sem salário na folha` : ""}`;
}

/** Blocos no lugar dos cartões da tela enquanto os dados chegam. */
function Esqueleto() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <IndicadoresCarregando
        className="sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5"
        quantidade={5}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CartaoCarregando className="lg:col-span-2" altura="h-80" />
        <CartaoCarregando altura="h-80" />
      </div>
      <CartaoCarregando altura="h-80" />
    </TelaCarregando>
  );
}
