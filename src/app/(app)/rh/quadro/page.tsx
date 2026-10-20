import type { Metadata } from "next";
import { Suspense } from "react";
import { Filtros } from "@/components/dashboard/filtros";
import {
  Colunas,
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
import { Carregando, PageHeader } from "@/components/page-header";
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
  type FocoQuadro,
  origemDeSaidasPorTipo,
  origemDoQuadro,
} from "@/lib/rh/modais";
import { ROTULO_TURNOVER } from "@/lib/rh/turnover";
import { colaboradoresDoQuadro, metaDe } from "@/server/rh/dados";
import { type Busca, fimConsiderado, lerFiltros } from "@/server/rh/filtros";

export const metadata: Metadata = { title: "Quadro e turnover" };

export default function Page({ searchParams }: PageProps<"/rh/quadro">) {
  return (
    <>
      <PageHeader
        title="Quadro e turnover"
        description="Colaboradores ativos, admissões, desligamentos e turnover, a partir do cadastro do ponto (Secullum)."
      />
      <Suspense fallback={<Carregando />}>
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
  const [todos, metaTurnover] = await Promise.all([
    colaboradoresDoQuadro(),
    metaDe("rh.turnover", mes),
  ]);
  const cs = departamento
    ? todos.filter((c) => c.departamento_id === departamento)
    : todos;

  const ate = fimConsiderado(mes);
  const ativos = ativosEm(cs, ate).sort((a, b) => a.nome.localeCompare(b.nome));
  const movimento = movimentoDoMes(cs, mes);
  const historico = ultimasCompetencias(mes, 12).map((c) =>
    movimentoDoMes(cs, c),
  );

  const saidasPorTipo: Record<string, number> = {};
  for (const m of historico) {
    for (const [tipo, n] of Object.entries(m.desligamentosPorTipo)) {
      saidasPorTipo[tipo] = (saidasPorTipo[tipo] ?? 0) + n;
    }
  }
  const tipos = Object.entries(saidasPorTipo).sort((a, b) => b[1] - a[1]);
  // Cor presa ao tipo (mesma ordem sempre), nunca à posição no ranking.
  const COR_TIPO: Record<string, FatiaRosca["cor"]> = {
    voluntario: 1,
    involuntario: 2,
    termino_contrato: 3,
    efetivacao: 4,
    nao_classificado: 5,
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
    origemDoQuadro(cs, c, fimConsiderado(c), { foco, pessoas: true });
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
  const admissoes12 = historico.reduce((s, m) => s + m.admissoes, 0);
  const desligamentos12 = historico.reduce((s, m) => s + m.desligamentos, 0);

  const colunasMes: Coluna<MovimentoMes>[] = [
    { titulo: "Mês", valor: (m) => formatarMes(m.competencia) },
    { titulo: "Início", valor: (m) => m.inicio, numero: true },
    { titulo: "Admissões", valor: (m) => m.admissoes, numero: true },
    { titulo: "Desligamentos", valor: (m) => m.desligamentos, numero: true },
    { titulo: "Efetivações", valor: (m) => m.efetivacoes, numero: true },
    { titulo: "Fim", valor: (m) => m.fim, numero: true },
    { titulo: "Turnover", valor: (m) => formatarPct(m.turnover), numero: true },
  ];

  const colunasAtivos: Coluna<ColaboradorQuadro>[] = [
    { titulo: "Colaborador", valor: (c) => c.nome },
    { titulo: "Matrícula", valor: (c) => c.matricula ?? "—", numero: true },
    { titulo: "Departamento", valor: (c) => c.departamento },
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
            titulo="Colaboradores ativos"
            valor={formatarNumero(ativos.length)}
            detalhe={`Em ${formatarData(ate)}`}
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
            detalhe={`${desligamentos12} nos últimos 12 meses${movimento.efetivacoes ? ` · ${movimento.efetivacoes} efetivação(ões) à parte` : ""}`}
            serie={serie((m) => m.desligamentos)}
            origem={doMes("desligamentos")}
          />
          <CartaoIndicador
            titulo="Turnover do mês"
            valor={formatarPct(movimento.turnover)}
            status={status(movimento.turnover, metaTurnover)}
            meta={
              metaTurnover
                ? `Meta: até ${formatarPct(metaTurnover.meta)}`
                : "Defina a meta em Parâmetros"
            }
            detalhe="((admissões + desligamentos) ÷ 2) ÷ quadro médio"
            origem={doMes("turnover")}
          />
        </div>

        <Secao
          titulo="Evolução do quadro"
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
            descricao="Últimos 12 meses, pelo motivo no Secullum"
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
          Fonte: cadastro do ponto (Secullum). Quem não bate ponto (PJ,
          pró-labore) e a situação da folha (férias, afastados) entram com a
          importação da folha: a folha de 07/2026 tinha 45 ativos. A
          classificação dos motivos de desligamento pode ser ajustada em
          Parâmetros.
        </Nota>
      </div>
    </ProvedorDetalhe>
  );
}
