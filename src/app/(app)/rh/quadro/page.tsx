import type { Metadata } from "next";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { Filtros } from "@/components/dashboard/filtros";
import {
  BarrasHorizontais,
  Colunas,
  ColunasEspelhadas,
  type FatiaRosca,
  type ItemGrafico,
  Rosca,
} from "@/components/dashboard/graficos";
import { CartaoIndicador } from "@/components/dashboard/indicador";
import {
  type Coluna,
  Nota,
  paraBusca,
  Secao,
  Tabela,
} from "@/components/dashboard/tabela";
import { TabelaBusca } from "@/components/dashboard/tabela-busca";
import { ProvedorDetalhe } from "@/components/modal-detalhe";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import {
  competenciaDe,
  fimDoMes,
  formatarData,
  formatarMes,
  formatarNumero,
  formatarPct,
  ultimasCompetencias,
} from "@/lib/formato";
import { status } from "@/lib/indicadores";
import {
  ativosEm,
  type ColaboradorQuadro,
  formatarTempoDeCasa,
  type MovimentoMes,
  mesesDeCasa,
  movimentoDoMes,
} from "@/lib/rh/calculos";
import {
  agrupar,
  detalheDoGrupo,
  emTitulo,
  type GrupoHeadcount,
  maioresEOutros,
  ORDEM_CONTRATO,
  ROTULO_CONTRATO,
  SEM_INFORMACAO,
} from "@/lib/rh/headcount";
import {
  type FocoQuadro,
  origemDeSaidasPorTipo,
  origemDoQuadro,
} from "@/lib/rh/modais";
import { ROTULO_TURNOVER } from "@/lib/rh/turnover";
import {
  colaboradoresDoQuadro,
  configTurnover,
  metaDe,
} from "@/server/rh/dados";
import { type Busca, fimConsiderado, lerFiltros } from "@/server/rh/filtros";

export const metadata: Metadata = { title: "Quadro e turnover" };

export default function Page({ searchParams }: PageProps<"/rh/quadro">) {
  return (
    <>
      <PageHeader
        title="Quadro e turnover"
        description="Headcount por departamento, cargo e contrato, admissões, desligamentos e turnover, pelo Copiloto RH."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="rh.quadro">
          <Quadro busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

/** Valores distintos, em ordem, como opções de um filtro. */
const opcoesDe = (valores: string[]) =>
  [...new Set(valores)]
    .sort((a, b) => a.localeCompare(b))
    .map((v) => ({ valor: v, rotulo: v }));

async function Quadro({ busca }: { busca: Promise<Busca> }) {
  const meses = ultimasCompetencias(competenciaDe(new Date()), 24).reverse();
  const { mes, departamento, departamentos } = await lerFiltros(
    await busca,
    meses,
  );
  const [todos, metaTurnover, turnover] = await Promise.all([
    colaboradoresDoQuadro(),
    metaDe("rh.turnover", mes),
    configTurnover(),
  ]);
  const cs = departamento
    ? todos.filter((c) => c.departamento_id === departamento)
    : todos;

  const ate = fimConsiderado(mes);
  const ativos = ativosEm(cs, ate).sort((a, b) => a.nome.localeCompare(b.nome));
  const movimento = movimentoDoMes(cs, mes, turnover);
  const historico = ultimasCompetencias(mes, 12).map((c) =>
    movimentoDoMes(cs, c, turnover),
  );

  const saidasPorTipo: Record<string, number> = {};
  for (const m of historico) {
    for (const [tipo, n] of Object.entries(m.desligamentosPorTipo)) {
      saidasPorTipo[tipo] = (saidasPorTipo[tipo] ?? 0) + n;
    }
  }
  const tipos = Object.entries(saidasPorTipo)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  // Cor presa ao tipo (mesma ordem sempre), nunca à posição no ranking.
  const COR_TIPO: Record<string, Exclude<FatiaRosca["cor"], "neutro">> = {
    voluntario: 1,
    involuntario: 2,
    acordo: 3,
  };
  const serie = (valor: (m: MovimentoMes) => number): ItemGrafico[] =>
    historico.map((m) => ({
      chave: m.competencia,
      rotulo: formatarMes(m.competencia).slice(0, 3),
      titulo: formatarMes(m.competencia),
      valor: valor(m),
      texto: String(valor(m)),
      destaque: m.competencia === mes,
    }));
  // De onde vem cada número (modal ao clicar). A tela já exige rh.quadro.
  const doMes = (foco: FocoQuadro, c = mes) =>
    origemDoQuadro(cs, c, fimConsiderado(c), {
      foco,
      pessoas: true,
      turnover,
    });
  const janela = ultimasCompetencias(mes, 12);
  const inicioJanela = janela[0] as string;
  const periodo = `Desligamentos de ${formatarMes(inicioJanela)} a ${formatarMes(mes)}`;
  const saidasDoTipo = (tipo: string) =>
    cs
      .filter(
        (c) =>
          c.desligamento !== null &&
          c.desligamento >= inicioJanela &&
          c.desligamento <= fimDoMes(mes) &&
          (c.tipo_turnover ?? "nao_classificado") === tipo,
      )
      .sort((a, b) =>
        (b.desligamento ?? "").localeCompare(a.desligamento ?? ""),
      );
  // Headcount: ativos agrupados por departamento, contrato e cargo.
  const porDepartamento = agrupar(
    ativos,
    (c) => c.departamento,
    (v) => v,
  );
  const porContrato = agrupar(
    ativos,
    (c) => c.tipo_contrato,
    (v) => ROTULO_CONTRATO[v] ?? v,
  );
  // Cargos com 2 pessoas ou mais; os de 1 pessoa vão juntos em "Outros".
  const cargos = agrupar(ativos, (c) => c.cargo);
  const porCargo = maioresEOutros(
    cargos,
    cargos.filter((g) => g.pessoas.length > 1 || g.chave === SEM_INFORMACAO)
      .length,
    "cargos com 1 pessoa",
  );
  const corDoContrato = (g: GrupoHeadcount): FatiaRosca["cor"] => {
    const i = ORDEM_CONTRATO.findIndex((t) => t.toUpperCase() === g.chave);
    return i < 0 ? "neutro" : ((i + 1) as FatiaRosca["cor"]);
  };
  const detalhesDe = (
    grupos: GrupoHeadcount[],
    secao: string,
  ): Record<string, ReturnType<typeof detalheDoGrupo>> =>
    Object.fromEntries(
      grupos.map((g) => [
        g.chave,
        detalheDoGrupo(g, {
          secao,
          ate,
          total: ativos.length,
          subtitulo: `Ativos em ${formatarData(ate)}`,
        }),
      ]),
    );
  const semFolha = ativos.filter((c) => !c.tipo_contrato).length;

  const admissoes12 = historico.reduce((s, m) => s + m.admissoes, 0);
  const desligamentos12 = historico.reduce((s, m) => s + m.desligamentos, 0);

  const colunasMes: Coluna<MovimentoMes>[] = [
    { titulo: "Mês", valor: (m) => formatarMes(m.competencia) },
    { titulo: "Início", valor: (m) => m.inicio, numero: true },
    { titulo: "Admissões", valor: (m) => m.admissoes, numero: true },
    { titulo: "Desligamentos", valor: (m) => m.desligamentos, numero: true },
    { titulo: "Fim", valor: (m) => m.fim, numero: true },
    // Todos os tipos do Copiloto (Geral, Voluntário, Involuntário, Acordo).
    ...movimento.taxas.map(
      (t, i): Coluna<MovimentoMes> => ({
        titulo: t.rotulo,
        valor: (m) => formatarPct(m.taxas[i]?.valor ?? null),
        numero: true,
      }),
    ),
  ];

  const colunasAtivos: Coluna<ColaboradorQuadro>[] = [
    { titulo: "Colaborador", valor: (c) => c.nome },
    { titulo: "Matrícula", valor: (c) => c.matricula ?? "—", numero: true },
    { titulo: "Departamento", valor: (c) => c.departamento },
    { titulo: "Cargo", valor: (c) => (c.cargo ? emTitulo(c.cargo) : "—") },
    {
      titulo: "Admissão",
      valor: (c) => formatarData(c.admissao),
      numero: true,
    },
    {
      titulo: "Tempo de casa",
      valor: (c) =>
        c.admissao ? formatarTempoDeCasa(mesesDeCasa(c.admissao, ate)) : "—",
      numero: true,
    },
  ];

  return (
    <ProvedorDetalhe>
      <div className="flex flex-col gap-6">
        <Filtros
          meses={meses}
          mes={mes}
          departamentos={departamentos}
          departamento={departamento}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <CartaoIndicador
            titulo="Headcount"
            tom="escuro"
            valor={formatarNumero(ativos.length)}
            detalhe={`Colaboradores ativos em ${formatarData(ate)}`}
            serie={serie((m) => m.fim)}
            origem={doMes("ativos")}
          />
          <CartaoIndicador
            titulo="Admissões no mês"
            valor={String(movimento.admissoes)}
            detalhe={`${admissoes12} nos últimos 12 meses`}
            serie={serie((m) => m.admissoes)}
            origem={doMes("admissoes")}
          />
          <CartaoIndicador
            titulo="Desligamentos no mês"
            valor={String(movimento.desligamentos)}
            detalhe={`${desligamentos12} nos últimos 12 meses`}
            serie={serie((m) => m.desligamentos)}
            origem={doMes("desligamentos")}
          />
          <CartaoIndicador
            titulo="Turnover Geral do mês"
            tom="verde"
            valor={formatarPct(movimento.turnover)}
            status={status(movimento.turnover, metaTurnover)}
            meta={
              metaTurnover
                ? `Meta: até ${formatarPct(metaTurnover.meta)}`
                : "Defina a meta em Parâmetros"
            }
            detalhe={movimento.taxas
              .slice(1)
              .map(
                (t) =>
                  `${t.rotulo.replace("Turnover ", "")} ${formatarPct(t.valor)}`,
              )
              .join(" · ")}
            origem={doMes("turnover")}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Secao
            titulo="Evolução do headcount"
            descricao="Colaboradores ativos no fim de cada mês"
          >
            <Colunas
              descricao="Colaboradores ativos no fim de cada mês, últimos 12 meses"
              itens={historico.map((m) => ({
                chave: m.competencia,
                rotulo: formatarMes(m.competencia).slice(0, 3),
                titulo: formatarMes(m.competencia),
                valor: m.fim,
                texto: String(m.fim),
                detalhe: `+${m.admissoes} admissões · −${m.desligamentos} desligamentos`,
                destaque: m.competencia === mes,
              }))}
              detalhes={Object.fromEntries(
                historico.map((m) => [
                  m.competencia,
                  doMes("ativos", m.competencia),
                ]),
              )}
            />
          </Secao>
          <Secao
            titulo="Admissões × desligamentos"
            descricao={`Últimos 12 meses: ${admissoes12} admissões e ${desligamentos12} desligamentos`}
          >
            <ColunasEspelhadas
              descricao="Admissões e desligamentos por mês, últimos 12 meses"
              rotulos={{ acima: "Admissões", abaixo: "Desligamentos" }}
              itens={historico.map((m) => ({
                chave: m.competencia,
                rotulo: formatarMes(m.competencia).slice(0, 3),
                titulo: formatarMes(m.competencia),
                acima: m.admissoes,
                abaixo: m.desligamentos,
                destaque: m.competencia === mes,
              }))}
              detalhes={Object.fromEntries(
                historico.map((m) => [
                  m.competencia,
                  doMes("admissoes", m.competencia),
                ]),
              )}
            />
          </Secao>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <Secao
            titulo="Headcount por departamento"
            tom="verde"
            descricao={`Ativos em ${formatarData(ate)}; clique para ver quem é`}
            className="xl:col-span-3"
          >
            <BarrasHorizontais
              descricao="Headcount por departamento"
              vazio="Ninguém ativo no período."
              itens={porDepartamento.map((g) => ({
                chave: g.chave,
                rotulo: g.rotulo,
                valor: g.pessoas.length,
                texto: String(g.pessoas.length),
                detalhe: `${Math.round((g.pessoas.length / Math.max(ativos.length, 1)) * 100)}% do headcount`,
              }))}
              detalhes={detalhesDe(
                porDepartamento,
                "Headcount por departamento",
              )}
            />
          </Secao>
          <Secao
            titulo="Por tipo de contrato"
            descricao={
              semFolha
                ? `${semFolha} pessoa(s) sem contrato: estão no ponto e não na folha`
                : "Pela última folha importada"
            }
            className="xl:col-span-2"
          >
            <Rosca
              descricao="Headcount por tipo de contrato"
              vazio="Ninguém ativo no período."
              centro={{ valor: String(ativos.length), rotulo: "pessoas" }}
              fatias={[...porContrato]
                .sort((a, b) => {
                  const ca = corDoContrato(a);
                  const cb = corDoContrato(b);
                  return (
                    (ca === "neutro" ? 9 : ca) - (cb === "neutro" ? 9 : cb)
                  );
                })
                .map((g) => ({
                  chave: g.chave,
                  rotulo: g.rotulo,
                  valor: g.pessoas.length,
                  texto: String(g.pessoas.length),
                  cor: corDoContrato(g),
                }))}
              detalhes={detalhesDe(porContrato, "Headcount por contrato")}
            />
          </Secao>
        </div>

        <Secao
          titulo="Headcount por cargo"
          descricao={`Cargos com 2 pessoas ou mais; o cargo vem da folha (${porCargo.find((g) => g.chave === SEM_INFORMACAO)?.pessoas.length ?? 0} sem cargo). Clique para ver quem é`}
        >
          <BarrasHorizontais
            descricao="Headcount por cargo"
            rotuloLargo
            vazio="Nenhum cargo: importe a folha."
            itens={porCargo.map((g) => ({
              chave: g.chave,
              rotulo: g.rotulo,
              valor: g.pessoas.length,
              texto: String(g.pessoas.length),
              detalhe: `${Math.round((g.pessoas.length / Math.max(ativos.length, 1)) * 100)}% do headcount`,
            }))}
            detalhes={detalhesDe(porCargo, "Headcount por cargo")}
          />
        </Secao>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Secao titulo="Mês a mês" className="lg:col-span-2">
            <Tabela
              colunas={colunasMes}
              linhas={[...historico].reverse()}
              chave={(m) => m.competencia}
            />
          </Secao>
          <Secao
            titulo="Desligamentos por tipo"
            tom="escuro"
            descricao="Últimos 12 meses, pelo motivo do desligamento no Copiloto"
            className="flex flex-col"
          >
            <div className="flex h-full flex-col justify-center">
              <Rosca
                descricao="Desligamentos dos últimos 12 meses por tipo"
                vazio="Nenhum desligamento nos últimos 12 meses."
                centro={{
                  valor: String(tipos.reduce((soma, [, n]) => soma + n, 0)),
                  rotulo: "saídas em 12 meses",
                }}
                fatias={tipos
                  .sort(([a], [b]) => (COR_TIPO[a] ?? 5) - (COR_TIPO[b] ?? 5))
                  .map(([tipo, n]) => ({
                    chave: tipo,
                    rotulo: ROTULO_TURNOVER[tipo] ?? tipo,
                    valor: n,
                    texto: String(n),
                    cor: COR_TIPO[tipo] ?? 5,
                  }))}
                detalhes={Object.fromEntries(
                  tipos.map(([tipo]) => [
                    tipo,
                    origemDeSaidasPorTipo(
                      saidasDoTipo(tipo),
                      ROTULO_TURNOVER[tipo] ?? tipo,
                      periodo,
                      true,
                    ),
                  ]),
                )}
              />
            </div>
          </Secao>
        </div>

        <Secao
          titulo={`Ativos em ${formatarData(ate)}`}
          descricao={`${ativos.length} pessoas`}
        >
          <TabelaBusca
            placeholder="Buscar pelo nome ou matrícula…"
            porPagina={10}
            filtros={[
              {
                chave: "dep",
                rotulo: "Departamento",
                todos: "Todos os departamentos",
                opcoes: opcoesDe(ativos.map((c) => c.departamento)),
              },
              {
                chave: "ano",
                rotulo: "Ano de admissão",
                todos: "Todos os anos",
                opcoes: opcoesDe(
                  ativos.map((c) => c.admissao?.slice(0, 4) ?? "—"),
                ).reverse(),
              },
            ]}
            {...paraBusca(
              colunasAtivos,
              ativos,
              (c) => c.id,
              (c) => `${c.nome} ${c.matricula ?? ""}`,
              (c) => ({
                dep: c.departamento,
                ano: c.admissao?.slice(0, 4) ?? "—",
              }),
            )}
          />
        </Secao>

        <Nota>
          Fonte: Copiloto RH (colaboradores, tipo de contrato, admissões,
          desligamentos e motivo), sincronizado todo dia. O turnover usa os
          tipos, a classificação dos motivos e as fórmulas do Copiloto;
          departamento vem do ponto e cargo, da folha.
        </Nota>
      </div>
    </ProvedorDetalhe>
  );
}

/** Blocos no lugar dos cartões da tela enquanto os dados chegam. */
function Esqueleto() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <IndicadoresCarregando quantidade={4} />
      <CartaoCarregando altura="h-80" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CartaoCarregando className="lg:col-span-2" altura="h-[28rem]" />
        <CartaoCarregando altura="h-[28rem]" />
      </div>
      <CartaoCarregando altura="h-96" />
    </TelaCarregando>
  );
}
