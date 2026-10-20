import type { Metadata } from "next";
import { Suspense } from "react";
import { Filtros } from "@/components/dashboard/filtros";
import {
  BarrasHorizontais,
  Pontos,
  Rosca,
} from "@/components/dashboard/graficos";
import { CartaoIndicador } from "@/components/dashboard/indicador";
import {
  type Coluna,
  Nota,
  Secao,
  Tabela,
} from "@/components/dashboard/tabela";
import { ProvedorDetalhe } from "@/components/modal-detalhe";
import { Carregando, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import {
  formatarData,
  formatarHoras,
  formatarMes,
  formatarNumero,
  formatarPct,
} from "@/lib/formato";
import { status } from "@/lib/indicadores";
import {
  absenteismo,
  colunasDeAbono,
  type LinhaPonto,
  porSetor,
  somarPonto,
  type TotaisSetor,
} from "@/lib/rh/calculos";
import {
  origemDasHorasPerdidas,
  origemDoAbsenteismo,
  origemDoBanco,
  origemDoSetor,
  origemDosAbonos,
} from "@/lib/rh/modais";
import { pode } from "@/server/auth";
import {
  bancoHorasEmReais,
  competenciasDoPonto,
  metaDe,
  pontoDoMes,
} from "@/server/rh/dados";
import { type Busca, fimConsiderado, lerFiltros } from "@/server/rh/filtros";

export const metadata: Metadata = { title: "Jornada" };

export default function Page({ searchParams }: PageProps<"/rh/jornada">) {
  return (
    <>
      <PageHeader
        title="Jornada"
        description="Absenteísmo e banco de horas por setor e por funcionário, a partir do ponto (Secullum)."
      />
      <Suspense fallback={<Carregando />}>
        <Protegido permissao="rh.jornada">
          <Jornada busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

async function Jornada({ busca }: { busca: Promise<Busca> }) {
  const meses = await competenciasDoPonto();
  const { mes, departamento, departamentos } = await lerFiltros(
    await busca,
    meses,
  );
  const [todas, metaAbs, reais] = await Promise.all([
    pontoDoMes(mes),
    metaDe("rh.absenteismo", mes),
    pode("rh.custo_pessoal").then((p) => (p ? bancoHorasEmReais(mes) : null)),
  ]);
  const linhas = departamento
    ? todas.filter((l) => l.departamento_id === departamento)
    : todas;

  const totais = somarPonto(linhas);
  const setores = porSetor(linhas);
  const abonos = colunasDeAbono(linhas);
  const meta = metaAbs
    ? { valor: metaAbs.meta, texto: `Meta: até ${formatarPct(metaAbs.meta)}` }
    : undefined;
  // De onde vem cada número (modal ao clicar). A tela já exige rh.jornada.
  const opcoes = {
    mes,
    ate: fimConsiderado(mes),
    pessoas: true,
    meta: metaAbs ? `até ${formatarPct(metaAbs.meta)}` : undefined,
  };
  const horasPerdidas = {
    faltas: origemDasHorasPerdidas(linhas, "faltas", opcoes),
    atrasos: origemDasHorasPerdidas(linhas, "atrasos", opcoes),
  };
  const pessoas = [...linhas].sort(
    (a, b) =>
      (absenteismo(b) ?? -1) - (absenteismo(a) ?? -1) ||
      a.nome.localeCompare(b.nome),
  );

  const colunasSetor: Coluna<TotaisSetor>[] = [
    { titulo: "Setor", valor: (s) => s.departamento },
    { titulo: "Pessoas", valor: (s) => s.colaboradores, numero: true },
    {
      titulo: "Horas previstas",
      valor: (s) => formatarHoras(s.previstas_min),
      numero: true,
    },
    {
      titulo: "Faltas",
      valor: (s) => formatarHoras(s.faltas_min),
      numero: true,
    },
    {
      titulo: "Atrasos",
      valor: (s) => formatarHoras(s.atrasos_min),
      numero: true,
    },
    {
      titulo: "Abonos",
      valor: (s) => formatarHoras(s.abonos_min),
      numero: true,
    },
    {
      titulo: "Absenteísmo",
      valor: (s) => formatarPct(s.absenteismo),
      numero: true,
    },
    {
      titulo: "Banco (+)",
      valor: (s) => formatarHoras(s.banco_positivo_min),
      numero: true,
    },
    {
      titulo: "Banco (−)",
      valor: (s) => formatarHoras(s.banco_negativo_min),
      numero: true,
    },
  ];

  const colunasPessoa: Coluna<LinhaPonto>[] = [
    { titulo: "Colaborador", valor: (l) => l.nome },
    { titulo: "Matrícula", valor: (l) => l.matricula ?? "—", numero: true },
    { titulo: "Setor", valor: (l) => l.departamento },
    {
      titulo: "Previstas",
      valor: (l) => formatarHoras(l.previstas_min),
      numero: true,
    },
    {
      titulo: "Faltas",
      valor: (l) => formatarHoras(l.faltas_min),
      numero: true,
    },
    {
      titulo: "Dias de falta",
      valor: (l) => formatarNumero(l.faltas_dias, 1),
      numero: true,
    },
    {
      titulo: "Atrasos",
      valor: (l) => formatarHoras(l.atrasos_min),
      numero: true,
    },
    ...abonos.map(
      (a): Coluna<LinhaPonto> => ({
        titulo: a,
        valor: (l) => formatarHoras(l.abonos_min[a] ?? 0),
        numero: true,
      }),
    ),
    {
      titulo: "Absenteísmo",
      valor: (l) => formatarPct(absenteismo(l)),
      numero: true,
    },
    {
      titulo: "Banco (saldo)",
      valor: (l) => formatarHoras(l.banco_saldo_min),
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
            titulo="Absenteísmo"
            valor={formatarPct(totais.absenteismo)}
            status={status(totais.absenteismo, metaAbs)}
            meta={
              metaAbs
                ? `Meta: até ${formatarPct(metaAbs.meta)}`
                : "Defina a meta em Parâmetros"
            }
            detalhe={`${totais.colaboradores} pessoas no período`}
            origem={origemDoAbsenteismo(linhas, opcoes)}
          />
          <CartaoIndicador
            titulo="Faltas"
            valor={formatarHoras(totais.faltas_min)}
            detalhe={`${formatarNumero(totais.faltas_dias, 1)} dias · atrasos ${formatarHoras(totais.atrasos_min)}`}
            origem={horasPerdidas.faltas}
          />
          <CartaoIndicador
            titulo="Abonos"
            valor={formatarHoras(totais.abonos_min)}
            detalhe="Não entram no absenteísmo"
            origem={origemDosAbonos(linhas, abonos, opcoes)}
          />
          <CartaoIndicador
            titulo="Banco de horas"
            valor={formatarHoras(totais.banco_saldo_min)}
            detalhe={`Positivo ${formatarHoras(totais.banco_positivo_min)} · negativo ${formatarHoras(totais.banco_negativo_min)}`}
            origem={origemDoBanco(linhas, {
              ...opcoes,
              meta: undefined,
              reais:
                reais && departamento
                  ? {
                      ...reais,
                      valor: reais.porDepartamento.get(departamento) ?? null,
                    }
                  : reais,
            })}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <Secao
            titulo="Absenteísmo por setor"
            descricao={`${formatarMes(mes)} · passe o mouse para ver faltas e atrasos`}
            className="xl:col-span-3"
          >
            <BarrasHorizontais
              descricao="Absenteísmo por setor"
              meta={meta}
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
                    linhas.filter(
                      (l) => l.departamento_id === s.departamento_id,
                    ),
                    opcoes,
                  ),
                ]),
              )}
            />
          </Secao>
          <Secao
            titulo="Horas perdidas"
            descricao="O que forma o absenteísmo do mês"
            className="xl:col-span-2"
          >
            <Rosca
              descricao="Horas perdidas: faltas e atrasos"
              centro={{
                valor: formatarHoras(totais.faltas_min + totais.atrasos_min),
                rotulo: `de ${formatarHoras(totais.previstas_min)} previstas`,
              }}
              fatias={[
                {
                  chave: "faltas",
                  rotulo: "Faltas",
                  valor: totais.faltas_min,
                  texto: formatarHoras(totais.faltas_min),
                  cor: 1,
                },
                {
                  chave: "atrasos",
                  rotulo: "Atrasos",
                  valor: totais.atrasos_min,
                  texto: formatarHoras(totais.atrasos_min),
                  cor: 2,
                },
              ]}
              detalhes={horasPerdidas}
            />
          </Secao>
        </div>

        <Secao
          titulo="Absenteísmo por funcionário"
          descricao="Cada bolinha é uma pessoa; passe o mouse para ver quem é. Os números estão na tabela abaixo."
        >
          <Pontos
            descricao="Absenteísmo de cada funcionário no mês"
            sufixo="%"
            meta={meta}
            itens={pessoas
              .filter((l) => absenteismo(l) !== null)
              .map((l) => ({
                chave: l.colaborador_id,
                rotulo: l.nome,
                valor: absenteismo(l) ?? 0,
                texto: formatarPct(absenteismo(l)),
                detalhe: `${l.departamento} · faltas ${formatarHoras(l.faltas_min)} · atrasos ${formatarHoras(l.atrasos_min)}`,
              }))}
          />
        </Secao>

        <Secao titulo="Por setor">
          <Tabela
            colunas={colunasSetor}
            linhas={setores}
            chave={(s) => s.departamento_id ?? "sem"}
            rodape={[
              "Total",
              totais.colaboradores,
              formatarHoras(totais.previstas_min),
              formatarHoras(totais.faltas_min),
              formatarHoras(totais.atrasos_min),
              formatarHoras(totais.abonos_min),
              formatarPct(totais.absenteismo),
              formatarHoras(totais.banco_positivo_min),
              formatarHoras(totais.banco_negativo_min),
            ]}
          />
        </Secao>

        <Secao
          titulo="Por funcionário"
          descricao="Do maior absenteísmo para o menor"
        >
          <Tabela
            colunas={colunasPessoa}
            linhas={pessoas}
            chave={(l) => l.colaborador_id}
          />
        </Secao>

        <Nota>
          Fonte: ponto (Secullum) de {formatarData(mes)} a{" "}
          {formatarData(fimConsiderado(mes))}. Absenteísmo = (faltas + atrasos)
          ÷ horas previstas. Os abonos ({abonos.join(", ") || "nenhum"})
          aparecem separados até a confirmação de qual coluna é atestado. Horas
          extras vêm da folha, não do ponto.
        </Nota>
      </div>
    </ProvedorDetalhe>
  );
}
