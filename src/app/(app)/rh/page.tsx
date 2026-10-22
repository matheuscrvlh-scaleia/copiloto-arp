import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
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
  competenciasDoPeriodo,
  descreverPeriodo,
  type Periodo,
  paramsDoPeriodo,
} from "@/lib/periodo";
import { ativosEm, porSetor, somarPonto } from "@/lib/rh/calculos";
import { custosPor, saldosEmReais, somarCustos } from "@/lib/rh/custo";
import { movimentoEntre } from "@/lib/rh/detalhes";
import {
  type FocoQuadro,
  origemDoAbsenteismo,
  origemDoBanco,
  origemDoCustoSobreReceita,
  origemDoCustoTotal,
  origemDoQuadro,
  origemDoSetor,
} from "@/lib/rh/modais";
import { avisoDoPonto } from "@/lib/rh/ponto-periodo";
import { pode } from "@/server/auth";
import {
  type BancoEmReais,
  bancoHorasEmReais,
  colaboradoresDoQuadro,
  custoAgregado,
  custosIndividuais,
  faturamentoDe,
  folhasDoCusto,
  metaDe,
  pontoDoPeriodo,
  valorDaHora,
} from "@/server/rh/dados";
import {
  type Busca,
  fimConsiderado,
  lerFiltrosDoPeriodo,
} from "@/server/rh/filtros";
import { turnoverDoPeriodo } from "@/server/rh/turnover";

export const metadata: Metadata = { title: "Painel de RH" };

export default function Page({ searchParams }: PageProps<"/rh">) {
  return (
    <>
      <PageHeader
        title="Painel de RH"
        description="Indicadores de pessoal do período, com semáforo pela meta configurada em Parâmetros."
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
  rotulo: string,
): Variacao | undefined {
  if (atual === null || anterior === null) return undefined;
  const d = atual - anterior;
  return {
    texto: `${d > 0 ? "+" : ""}${formatarNumero(d, 1)} p.p. vs ${rotulo}`,
    sentido: Math.abs(d) < 0.05 ? "neutro" : d < 0 ? "bom" : "ruim",
  };
}

async function Painel({ busca }: { busca: Promise<Busca> }) {
  const { periodo, anterior, rotulo, mes, hoje, departamento, departamentos } =
    await lerFiltrosDoPeriodo(await busca);
  const rotuloAnt = descreverPeriodo(anterior);
  const doDep = <T extends { departamento_id: string | null }>(ls: T[]) =>
    departamento ? ls.filter((l) => l.departamento_id === departamento) : ls;

  const [
    pontoP,
    pontoAntP,
    todos,
    metaAbs,
    metaBanco,
    metaCusto,
    metaTurnover,
    custo,
    veJornada,
    veQuadro,
    turnover,
    hora,
  ] = await Promise.all([
    pontoDoPeriodo(periodo.de, periodo.ate),
    pontoDoPeriodo(anterior.de, anterior.ate),
    colaboradoresDoQuadro().then(doDep),
    metaDe("rh.absenteismo", mes),
    metaDe("rh.banco_horas_positivo", mes),
    metaDe("rh.custo_sobre_receita", mes),
    metaDe("rh.turnover", mes),
    custoDoPainel(
      periodo,
      departamento,
      new Map(departamentos.map((d) => [d.id, d.nome])),
    ),
    // Lista de pessoas no modal só para quem já as vê nas telas do RH.
    pode("rh.jornada"),
    pode("rh.quadro"),
    // Turnover: direto do Copiloto, no período e nos 12 meses até ele.
    Promise.all([
      turnoverDoPeriodo(periodo.de, periodo.ate, departamento),
      turnoverDoPeriodo(
        ultimasCompetencias(mes, 12)[0] as string,
        fimConsiderado(mes),
        departamento,
      ),
    ]),
    // Banco em R$ por pessoa revela o salário: só com o custo individual.
    pode("rh.custo_pessoal.individual").then((p) =>
      p ? valorDaHora(mes) : null,
    ),
  ]);

  const ponto = doDep(pontoP.linhas);
  const aviso = avisoDoPonto(pontoP);
  const totais = somarPonto(ponto);
  const pontoAnt = doDep(pontoAntP.linhas);
  const totaisAnt =
    pontoAnt.length && !avisoDoPonto(pontoAntP).parcial
      ? somarPonto(pontoAnt)
      : null;
  const ativos = ativosEm(todos, periodo.ate).length;
  const ativosAnt = ativosEm(todos, anterior.ate).length;
  const [doPeriodo, dozeMeses] = turnover;
  const tv = doPeriodo.ok ? doPeriodo.dados : null;
  const semTurnover = doPeriodo.ok ? undefined : doPeriodo.motivo;
  // Sem o Copiloto, as contagens saem da lista de pessoas (o turnover não).
  const pessoas = movimentoEntre(todos, periodo.de, periodo.ate);
  const movimento = tv ?? {
    admissoes: pessoas.admitidos.length,
    desligamentos: pessoas.desligados.length,
  };
  const doMes = new Map(
    dozeMeses.ok ? dozeMeses.dados.mensal.map((m) => [m.competencia, m]) : [],
  );
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

  // De onde vem cada número (modal ao clicar). Os links levam o período.
  const filtrosUrl = (dep = departamento) =>
    new URLSearchParams({
      ...paramsDoPeriodo(periodo),
      ...(dep ? { dep } : {}),
    }).toString();
  const linkJornada = (dep = departamento) => ({
    href: `/rh/jornada?${filtrosUrl(dep)}`,
    rotulo: "Abrir a Jornada",
  });
  const opcoesPonto = {
    mes: pontoP.efetivo?.de ?? periodo.de,
    ate: pontoP.efetivo?.ate ?? periodo.ate,
    pessoas: veJornada,
    link: veJornada ? linkJornada() : undefined,
  };
  const quadroDe = (
    foco: FocoQuadro,
    de: string,
    ate: string,
    nome: string,
    numeros = de === periodo.de && ate === periodo.ate
      ? tv
      : (doMes.get(de) ?? null),
  ) =>
    origemDoQuadro(todos, de, ate, {
      foco,
      pessoas: veQuadro,
      numeros,
      semTurnover,
      rotulo: nome,
      link: veQuadro
        ? {
            href: `/rh/quadro?${filtrosUrl()}`,
            rotulo: "Abrir Quadro e turnover",
          }
        : undefined,
    });
  const quadroDoPeriodo = (foco: FocoQuadro) =>
    quadroDe(foco, periodo.de, periodo.ate, rotulo);
  const linkCusto = custo.competencia
    ? {
        href: `/rh/custo-de-pessoal?${filtrosUrl()}`,
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
  const metaTexto = (m: { meta: number } | null, f: (v: number) => string) =>
    m ? `Meta: até ${f(m.meta)}` : "Defina a meta em Parâmetros";

  return (
    <ProvedorDetalhe>
      <div className="flex flex-col gap-6">
        <FiltroPeriodo
          de={periodo.de}
          ate={periodo.ate}
          atalho={periodo.atalho}
          hoje={hoje}
          departamentos={departamentos}
          departamento={departamento}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {custo.totais && custo.sobreReceita !== null ? (
            <CartaoIndicador
              titulo="Custo de pessoal sobre a receita"
              valor={formatarPct(custo.sobreReceita)}
              status={status(custo.sobreReceita, metaCusto)}
              meta={metaTexto(metaCusto, (v) => formatarPct(v))}
              detalhe={`${custo.rotulo} · custo ÷ faturamento bruto`}
              origem={origemReceita}
            />
          ) : (
            <CartaoPendente
              titulo="Custo de pessoal sobre a receita"
              motivo={
                custo.totais && custo.competencia
                  ? departamento
                    ? "Por departamento não há receita: o % é só da empresa."
                    : `Falta o faturamento de ${custo.semFaturamento.map(formatarMes).join(", ")} (lançado em Cadastros até a API do ENET).`
                  : custo.motivo
              }
              meta={
                metaCusto
                  ? metaTexto(metaCusto, (v) => formatarPct(v))
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
              detalhe={`${custo.rotulo} · ${custo.totais.colaboradores} pessoas${custo.ficticia ? " · salários fictícios (protótipo)" : ""}`}
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
            detalhe={`Ativos em ${formatarData(periodo.ate)} (Copiloto RH)`}
            serie={evolucao}
            variacao={{
              texto: `${ativos - ativosAnt >= 0 ? "+" : ""}${ativos - ativosAnt} vs ${formatarData(anterior.ate)}`,
              sentido: "neutro",
            }}
            origem={quadroDe("ativos", periodo.de, periodo.ate, rotulo)}
          />
          {aviso.semDado ? (
            <CartaoPendente
              titulo="Absenteísmo"
              motivo={aviso.semDado}
              meta={
                metaAbs ? metaTexto(metaAbs, (v) => formatarPct(v)) : undefined
              }
            />
          ) : (
            <CartaoIndicador
              titulo="Absenteísmo"
              tom="verde"
              valor={formatarPct(totais.absenteismo)}
              status={status(totais.absenteismo, metaAbs)}
              meta={metaTexto(metaAbs, (v) => formatarPct(v))}
              variacao={variacaoPp(
                totais.absenteismo,
                totaisAnt?.absenteismo ?? null,
                rotuloAnt,
              )}
              detalhe={aviso.parcial ?? "Faltas e atrasos ÷ horas previstas"}
              origem={origemDoAbsenteismo(ponto, {
                ...opcoesPonto,
                meta: metaAbs ? `até ${formatarPct(metaAbs.meta)}` : undefined,
              })}
            />
          )}
          {aviso.semDado ? (
            <CartaoPendente
              titulo="Banco de horas positivo"
              motivo={aviso.semDado}
              meta={
                metaBanco
                  ? metaTexto(metaBanco, (v) => `${formatarNumero(v)}h`)
                  : undefined
              }
            />
          ) : (
            <CartaoIndicador
              titulo="Banco de horas positivo"
              valor={formatarHoras(totais.banco_positivo_min)}
              status={status(ponto.length ? bancoHoras : null, metaBanco)}
              meta={metaTexto(metaBanco, (v) => `${formatarNumero(v)}h`)}
              detalhe={`Saldo em ${formatarData(opcoesPonto.ate)}: ${formatarHoras(totais.banco_saldo_min)} · ${textoBancoEmReais(banco, bancoValor, custo.podeVer)}`}
              origem={origemDoBanco(ponto, {
                ...opcoesPonto,
                soPositivo: true,
                reais: custo.podeVer ? banco : null,
                porPessoa: hora
                  ? saldosEmReais(ponto, hora.salarioHora, hora.adicional)
                  : undefined,
                meta: metaBanco
                  ? `até ${formatarNumero(metaBanco.meta)}h`
                  : undefined,
              })}
            />
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Secao
            titulo="Evolução do headcount"
            descricao="Colaboradores ativos no fim de cada mês (Copiloto RH)"
            className="lg:col-span-2"
          >
            <Colunas
              itens={evolucao}
              descricao="Colaboradores ativos no fim de cada mês, últimos 12 meses"
              detalhes={Object.fromEntries(
                evolucao.map((e) => [
                  e.chave,
                  quadroDe(
                    "ativos",
                    e.chave,
                    fimConsiderado(e.chave),
                    e.titulo,
                  ),
                ]),
              )}
            />
          </Secao>

          <Secao tom="escuro" titulo="Movimento" descricao={rotulo}>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <AbreDetalhe
                detalhe={quadroDoPeriodo("admissoes")}
                className="-m-2 rounded-2xl p-2 hover:bg-white/50"
              >
                <p className="text-neutral-500">Admissões</p>
                <p className="text-2xl font-semibold">{movimento.admissoes}</p>
              </AbreDetalhe>
              <AbreDetalhe
                detalhe={quadroDoPeriodo("desligamentos")}
                className="-m-2 rounded-2xl p-2 hover:bg-white/50"
              >
                <p className="text-neutral-500">Desligamentos</p>
                <p className="text-2xl font-semibold">
                  {movimento.desligamentos}
                </p>
              </AbreDetalhe>
              <AbreDetalhe
                detalhe={quadroDoPeriodo("turnover")}
                className="col-span-2 -m-2 mt-2 rounded-2xl p-2 hover:bg-white/50"
              >
                <p className="text-neutral-500">Turnover Geral</p>
                <p className="mt-1 flex items-center gap-3">
                  <span className="text-2xl font-semibold">
                    {formatarPct(tv?.turnover ?? null)}
                  </span>
                  {tv && (
                    <SeloStatus status={status(tv.turnover, metaTurnover)} />
                  )}
                </p>
              </AbreDetalhe>
            </div>
            <p className="mt-4 text-xs text-neutral-500">
              {tv
                ? `${tv.taxas
                    .slice(1)
                    .map(
                      (t) =>
                        `${t.rotulo.replace("Turnover ", "")}: ${formatarPct(t.valor)}`,
                    )
                    .join(" · ")} · Copiloto RH`
                : semTurnover}
            </p>
            <Link
              href={`/rh/quadro?${filtrosUrl()}`}
              className="mt-4 inline-block text-sm font-medium underline-offset-4 hover:underline"
            >
              Ver quadro e turnover →
            </Link>
          </Secao>
        </div>

        <Secao
          titulo="Absenteísmo por setor"
          descricao={`${rotulo} · faltas e atrasos ÷ horas previstas`}
        >
          {aviso.semDado ? (
            <p className="text-sm text-neutral-500">{aviso.semDado}</p>
          ) : (
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
                    ponto.filter(
                      (l) => l.departamento_id === s.departamento_id,
                    ),
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
          )}
          <Link
            href={linkJornada().href}
            className="mt-4 inline-block text-sm font-medium underline-offset-4 hover:underline"
          >
            Ver jornada por funcionário →
          </Link>
        </Secao>

        <Nota>
          Fontes: ponto (Secullum) de {formatarData(opcoesPonto.mes)} a{" "}
          {formatarData(opcoesPonto.ate)}, sincronizado todo dia (o dia de hoje
          entra amanhã); colaboradores, admissões, desligamentos e turnover do
          Copiloto RH; custo pela folha de cada mês do período, com encargos,
          provisões e benefícios dos Parâmetros. Custo e receita são mensais: um
          período dentro do mês mostra o mês inteiro.
        </Nota>
      </div>
    </ProvedorDetalhe>
  );
}

/**
 * Custo das folhas dos meses do período (soma), ou da última folha antes
 * dele, no recorte do filtro. Custo é mensal: período dentro de um mês usa o
 * mês inteiro.
 */
async function custoDoPainel(
  periodo: Periodo,
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
    rotulo: "",
    semFaturamento: [] as string[],
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

  const doPeriodo = competenciasDoPeriodo(periodo);
  const ultimoMes = doPeriodo.at(-1) as string;
  const janela = ultimasCompetencias(ultimoMes, 12 + doPeriodo.length);
  const [todas, folhas, banco] = await Promise.all([
    custoAgregado(janela[0] as string, ultimoMes),
    folhasDoCusto(),
    bancoHorasEmReais(ultimoMes),
  ]);
  const linhas = departamento
    ? todas.filter((l) => l.departamento_id === departamento)
    : todas;
  const meses = [...new Set(linhas.map((l) => l.competencia))].sort();
  // Meses do período com folha; sem nenhum, a última folha antes dele.
  const comFolha = meses.filter((c) => doPeriodo.includes(c));
  const usados = comFolha.length ? comFolha : meses.slice(-1);
  const competencia = usados.at(-1) ?? null;
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
  const totais = somarCustos(
    linhas.filter((l) => usados.includes(l.competencia)),
  );
  // Pessoas: as da última folha (somar meses contaria a mesma pessoa de novo).
  totais.colaboradores = doMes(competencia).colaboradores;
  const rotulo = comFolha.length
    ? usados.length === 1
      ? `Folha de ${formatarMes(competencia)}`
      : `Folhas de ${formatarMes(usados[0] as string)} a ${formatarMes(competencia)} (soma)`
    : `Última folha: ${formatarMes(competencia)}`;

  // Variação: os mesmos tantos meses antes.
  const antes = meses
    .filter((c) => c < (usados[0] as string))
    .slice(-usados.length);
  const totalAnt =
    antes.length === usados.length
      ? antes.reduce((s, c) => s + doMes(c).custo_total, 0)
      : null;
  const [faturamentos, pessoas] = await Promise.all([
    departamento
      ? Promise.resolve(null)
      : Promise.all(usados.map((c) => faturamentoDe(c))),
    individual && usados.length === 1 ? custosIndividuais(competencia) : null,
  ]);
  const semFaturamento = faturamentos
    ? usados.filter((_, i) => !faturamentos[i])
    : [];
  const faturamento =
    faturamentos && semFaturamento.length === 0
      ? faturamentos.reduce<number>((s, f) => s + (f ?? 0), 0)
      : null;
  const variacao: Variacao | undefined =
    totalAnt && antes.length
      ? {
          texto: `${totais.custo_total >= totalAnt ? "+" : ""}${formatarNumero(((totais.custo_total - totalAnt) / totalAnt) * 100, 1)}% vs ${antes.length === 1 ? formatarMes(antes[0] as string) : `${formatarMes(antes[0] as string)} a ${formatarMes(antes.at(-1) as string)}`}`,
          sentido: "neutro",
        }
      : undefined;
  return {
    podeVer,
    motivo: "",
    totais,
    competencia,
    rotulo,
    semFaturamento,
    ficticia: usados.some(
      (c) => folhas.find((f) => f.competencia === c)?.ficticia ?? false,
    ),
    porSetor: custosPor(
      linhas.filter((l) => usados.includes(l.competencia)),
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
    serie: meses.slice(-12).map((c) => {
      const t = doMes(c).custo_total;
      return {
        chave: c,
        rotulo: formatarMes(c).slice(0, 3),
        titulo: formatarMes(c),
        valor: t,
        texto: formatarMoeda(t, 0),
        destaque: usados.includes(c),
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
