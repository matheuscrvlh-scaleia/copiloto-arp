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
  BarrasDivergentes,
  BarrasHorizontais,
  type FatiaRosca,
  Pontos,
  Rosca,
} from "@/components/dashboard/graficos";
import {
  CartaoIndicador,
  type Variacao,
} from "@/components/dashboard/indicador";
import {
  type Coluna,
  Nota,
  Secao,
  Tabela,
} from "@/components/dashboard/tabela";
import { type Detalhe, ProvedorDetalhe } from "@/components/modal-detalhe";
import { PageHeader } from "@/components/page-header";
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
  extrasDe,
  type LinhaPonto,
  porSetor,
  somarPonto,
  type TotaisSetor,
} from "@/lib/rh/calculos";
import {
  tabelaDeExtras,
  tabelaDeHorasPerdidas,
  tabelaDoBanco,
} from "@/lib/rh/detalhes";
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
import {
  type Busca,
  fimConsiderado,
  lerFiltros,
  mesAnterior,
} from "@/server/rh/filtros";

export const metadata: Metadata = { title: "Jornada" };

export default function Page({ searchParams }: PageProps<"/rh/jornada">) {
  return (
    <>
      <PageHeader
        title="Jornada"
        description="Absenteísmo e banco de horas por setor e por funcionário, a partir do ponto (Secullum)."
      />
      <Suspense fallback={<Esqueleto />}>
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
  const anterior = mesAnterior(mes);
  const [todas, metaAbs, reais, todasAnt] = await Promise.all([
    pontoDoMes(mes),
    metaDe("rh.absenteismo", mes),
    pode("rh.custo_pessoal").then((p) => (p ? bancoHorasEmReais(mes) : null)),
    pontoDoMes(anterior),
  ]);
  const linhas = departamento
    ? todas.filter((l) => l.departamento_id === departamento)
    : todas;

  const totais = somarPonto(linhas);
  const linhasAnt = departamento
    ? todasAnt.filter((l) => l.departamento_id === departamento)
    : todasAnt;
  const totaisAnt = linhasAnt.length ? somarPonto(linhasAnt) : null;
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
  // Variação contra o mês anterior (menos é melhor em faltas e absenteísmo).
  const vsAnterior = (
    atual: number,
    antes: number | null | undefined,
    formato: (v: number) => string,
    menosEhMelhor = true,
  ): Variacao | undefined => {
    if (antes === null || antes === undefined) return undefined;
    const d = atual - antes;
    return {
      texto: `${d > 0 ? "+" : ""}${formato(d)} vs ${formatarMes(anterior)}`,
      sentido: d === 0 ? "neutro" : d < 0 === menosEhMelhor ? "bom" : "ruim",
    };
  };
  const pp = (v: number) => `${formatarNumero(v, 1)} p.p.`;
  const doSetor = (id: string | null) =>
    linhas.filter((l) => l.departamento_id === id);
  const chaveSetor = (id: string | null) => id ?? "sem";

  // Banco de horas: por setor e os extremos por pessoa.
  const detalheBancoSetor = Object.fromEntries(
    setores.map((s) => [
      chaveSetor(s.departamento_id),
      {
        secao: "Banco de horas",
        titulo: s.departamento,
        subtitulo: `Saldo de cada pessoa em ${formatarMes(mes)}, de quem mais deve para quem mais tem crédito`,
        resumo: [
          { rotulo: "Pessoas", valor: String(s.colaboradores) },
          {
            rotulo: "Créditos",
            valor: `+${formatarHoras(s.banco_positivo_min)}`,
          },
          {
            rotulo: "Débitos",
            valor: formatarHoras(-Math.abs(s.banco_negativo_min)),
          },
          { rotulo: "Saldo", valor: formatarHoras(s.banco_saldo_min) },
        ],
        tabelas: [tabelaDoBanco(doSetor(s.departamento_id))],
      } satisfies Detalhe,
    ]),
  );
  const porSaldo = [...linhas].sort(
    (a, b) => a.banco_saldo_min - b.banco_saldo_min,
  );
  const extremosBanco = [
    ...porSaldo.filter((l) => l.banco_saldo_min < 0).slice(0, 6),
    ...porSaldo
      .filter((l) => l.banco_saldo_min > 0)
      .slice(-6)
      .reverse(),
  ];

  // Horas extras: por tipo (cor fixa pela ordem dos tipos), setor e pessoa.
  const tiposExtra = Object.keys(totais.extras_por_tipo).sort((a, b) =>
    a.localeCompare(b, "pt-BR", { numeric: true }),
  );
  const fatiasExtras: FatiaRosca[] = tiposExtra.slice(0, 5).map((tipo, k) => ({
    chave: tipo,
    rotulo: tipo,
    valor: totais.extras_por_tipo[tipo] ?? 0,
    texto: formatarHoras(totais.extras_por_tipo[tipo] ?? 0),
    cor: (k + 1) as FatiaRosca["cor"],
  }));
  const detalheExtras: Detalhe = {
    secao: "Horas extras",
    titulo: `Horas extras de ${formatarMes(mes)}`,
    subtitulo: "Do ponto (Secullum), de quem fez mais para quem fez menos",
    resumo: [
      { rotulo: "Total", valor: formatarHoras(totais.extras_min) },
      ...tiposExtra.map((tipo) => ({
        rotulo: tipo,
        valor: formatarHoras(totais.extras_por_tipo[tipo] ?? 0),
      })),
      {
        rotulo: "Noturnas (parte)",
        valor: formatarHoras(totais.extras_noturnas_min),
      },
      {
        rotulo: "Intervalo (à parte)",
        valor: formatarHoras(totais.extras_intervalo_min),
      },
    ].slice(0, 8),
    tabelas: [tabelaDeExtras(linhas)],
  };
  const detalheExtrasPorTipo = Object.fromEntries(
    tiposExtra.map((tipo) => [
      tipo,
      {
        secao: "Horas extras",
        titulo: tipo,
        subtitulo: `Quem fez extras ${tipo === "Sem divisão por %" ? "sem divisão por percentual" : `a ${tipo.replace("Ex", "")}`} em ${formatarMes(mes)}`,
        tabelas: [tabelaDeExtras(linhas, tipo)],
      } satisfies Detalhe,
    ]),
  );
  const detalheExtrasSetor = Object.fromEntries(
    setores.map((s) => [
      chaveSetor(s.departamento_id),
      {
        secao: "Horas extras",
        titulo: s.departamento,
        subtitulo: `Horas extras de cada pessoa em ${formatarMes(mes)}`,
        resumo: [
          { rotulo: "Extras", valor: formatarHoras(s.extras_min) },
          {
            rotulo: "Noturnas (parte)",
            valor: formatarHoras(s.extras_noturnas_min),
          },
          {
            rotulo: "Intervalo (à parte)",
            valor: formatarHoras(s.extras_intervalo_min),
          },
          { rotulo: "Pessoas", valor: String(s.colaboradores) },
        ],
        tabelas: [tabelaDeExtras(doSetor(s.departamento_id))],
      } satisfies Detalhe,
    ]),
  );
  const maisExtras = [...linhas]
    .filter((l) => extrasDe(l).total > 0)
    .sort((a, b) => extrasDe(b).total - extrasDe(a).total)
    .slice(0, 10);

  // Faltas: por setor (horas e dias) e quem mais faltou.
  const detalheFaltasSetor = Object.fromEntries(
    setores.map((s) => [
      chaveSetor(s.departamento_id),
      {
        secao: "Faltas",
        titulo: s.departamento,
        subtitulo: `Quem teve faltas em ${formatarMes(mes)}`,
        resumo: [
          { rotulo: "Faltas", valor: formatarHoras(s.faltas_min) },
          { rotulo: "Dias", valor: formatarNumero(s.faltas_dias, 1) },
          {
            rotulo: "DSR descontado",
            valor: formatarHoras(Math.abs(s.dsr_debito_min)),
          },
          { rotulo: "Pessoas", valor: String(s.colaboradores) },
        ],
        tabelas: [tabelaDeHorasPerdidas(doSetor(s.departamento_id), "faltas")],
      } satisfies Detalhe,
    ]),
  );
  const maisFaltas = [...linhas]
    .filter((l) => l.faltas_min > 0)
    .sort((a, b) => b.faltas_min - a.faltas_min)
    .slice(0, 10);

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
      titulo: "Extras",
      valor: (s) => formatarHoras(s.extras_min),
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
      titulo: "Extras",
      valor: (l) => formatarHoras(extrasDe(l).total),
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <CartaoIndicador
            titulo="Absenteísmo"
            tom="escuro"
            valor={formatarPct(totais.absenteismo)}
            status={status(totais.absenteismo, metaAbs)}
            meta={
              metaAbs
                ? `Meta: até ${formatarPct(metaAbs.meta)}`
                : "Defina a meta em Parâmetros"
            }
            detalhe={`${totais.colaboradores} pessoas no período`}
            variacao={
              totais.absenteismo !== null
                ? vsAnterior(totais.absenteismo, totaisAnt?.absenteismo, pp)
                : undefined
            }
            origem={origemDoAbsenteismo(linhas, opcoes)}
          />
          <CartaoIndicador
            titulo="Faltas"
            valor={formatarHoras(totais.faltas_min)}
            detalhe={`${formatarNumero(totais.faltas_dias, 1)} dias · atrasos ${formatarHoras(totais.atrasos_min)}`}
            variacao={vsAnterior(
              totais.faltas_min,
              totaisAnt?.faltas_min,
              formatarHoras,
            )}
            origem={horasPerdidas.faltas}
          />
          <CartaoIndicador
            titulo="Horas extras"
            valor={formatarHoras(totais.extras_min)}
            detalhe={`${formatarHoras(totais.extras_noturnas_min)} à noite · intervalo ${formatarHoras(totais.extras_intervalo_min)} à parte`}
            variacao={vsAnterior(
              totais.extras_min,
              totaisAnt?.extras_min,
              formatarHoras,
            )}
            origem={detalheExtras}
          />
          <CartaoIndicador
            titulo="Abonos"
            valor={formatarHoras(totais.abonos_min)}
            detalhe="Não entram no absenteísmo"
            origem={origemDosAbonos(linhas, abonos, opcoes)}
          />
          <CartaoIndicador
            titulo="Banco de horas"
            tom="verde"
            valor={formatarHoras(totais.banco_saldo_min)}
            detalhe={`Positivo ${formatarHoras(totais.banco_positivo_min)} · negativo ${formatarHoras(totais.banco_negativo_min)}`}
            variacao={vsAnterior(
              totais.banco_saldo_min,
              totaisAnt?.banco_saldo_min,
              formatarHoras,
              false,
            )}
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
            tom="escuro"
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

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Secao
            titulo="Banco de horas por setor"
            descricao={`Débitos ← zero → créditos em ${formatarMes(mes)}; clique para ver cada pessoa`}
          >
            <BarrasDivergentes
              descricao="Banco de horas por setor: débitos e créditos"
              rotulos={{
                negativo: "Débito (devem horas)",
                positivo: "Crédito (a folgar ou pagar)",
              }}
              linhas={setores.map((s) => ({
                chave: chaveSetor(s.departamento_id),
                rotulo: s.departamento,
                negativo: Math.abs(s.banco_negativo_min),
                positivo: s.banco_positivo_min,
                textoNegativo: formatarHoras(-Math.abs(s.banco_negativo_min)),
                textoPositivo: `+${formatarHoras(s.banco_positivo_min)}`,
                resumo: `saldo ${formatarHoras(s.banco_saldo_min)}`,
                detalhe: `${s.colaboradores} pessoas`,
              }))}
              detalhes={detalheBancoSetor}
            />
            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  rotulo: "Créditos",
                  valor: `+${formatarHoras(totais.banco_positivo_min)}`,
                },
                {
                  rotulo: "Débitos",
                  valor: formatarHoras(-Math.abs(totais.banco_negativo_min)),
                },
                {
                  rotulo: "Devem horas",
                  valor: `${linhas.filter((l) => l.banco_saldo_min < 0).length} pessoas`,
                },
                {
                  rotulo: "Têm crédito",
                  valor: `${linhas.filter((l) => l.banco_saldo_min > 0).length} pessoas`,
                },
              ].map((x) => (
                <div
                  key={x.rotulo}
                  className="rounded-2xl bg-neutral-900/[0.04] px-4 py-3"
                >
                  <dt className="text-[11px] text-neutral-500">{x.rotulo}</dt>
                  <dd className="mt-0.5 text-lg font-semibold tabular-nums">
                    {x.valor}
                  </dd>
                </div>
              ))}
            </dl>
          </Secao>
          <Secao
            titulo="Banco de horas por pessoa"
            descricao="Quem mais deve horas e quem mais tem crédito"
          >
            <BarrasDivergentes
              descricao="Saldo do banco de horas: quem mais deve e quem mais tem crédito"
              rotulos={{ negativo: "Deve horas", positivo: "Tem crédito" }}
              linhas={extremosBanco.map((l) => ({
                chave: l.colaborador_id,
                rotulo: l.nome,
                negativo: Math.max(-l.banco_saldo_min, 0),
                positivo: Math.max(l.banco_saldo_min, 0),
                textoNegativo:
                  l.banco_saldo_min < 0 ? formatarHoras(l.banco_saldo_min) : "",
                textoPositivo:
                  l.banco_saldo_min > 0
                    ? `+${formatarHoras(l.banco_saldo_min)}`
                    : "",
                resumo: l.departamento,
                detalhe: `créditos +${formatarHoras(l.banco_creditos_min)} · débitos ${formatarHoras(-Math.abs(l.banco_debitos_min))}`,
              }))}
            />
          </Secao>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <Secao
            titulo="Horas extras por tipo"
            tom="escuro"
            descricao="Pelo percentual do ponto; clique para ver quem fez"
            className="xl:col-span-2"
          >
            <Rosca
              descricao="Horas extras por tipo"
              vazio="Nenhuma hora extra no período."
              centro={{
                valor: formatarHoras(totais.extras_min),
                rotulo: `${formatarHoras(totais.extras_noturnas_min)} à noite`,
              }}
              fatias={fatiasExtras}
              detalhes={detalheExtrasPorTipo}
            />
          </Secao>
          <Secao
            titulo="Horas extras por setor"
            descricao={`${formatarMes(mes)} · clique para ver cada pessoa`}
            className="xl:col-span-3"
          >
            <BarrasHorizontais
              descricao="Horas extras por setor"
              vazio="Nenhuma hora extra no período."
              itens={[...setores]
                .sort((a, b) => b.extras_min - a.extras_min)
                .map((s) => ({
                  chave: chaveSetor(s.departamento_id),
                  rotulo: s.departamento,
                  valor: s.extras_min / 60,
                  texto: formatarHoras(s.extras_min),
                  detalhe: `${formatarHoras(s.extras_noturnas_min)} à noite · intervalo ${formatarHoras(s.extras_intervalo_min)} à parte`,
                }))}
              detalhes={detalheExtrasSetor}
            />
          </Secao>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Secao
            titulo="Quem mais fez horas extras"
            descricao={`As 10 pessoas com mais extras em ${formatarMes(mes)}`}
          >
            <BarrasHorizontais
              descricao="As 10 pessoas com mais horas extras"
              vazio="Nenhuma hora extra no período."
              itens={maisExtras.map((l) => ({
                chave: l.colaborador_id,
                rotulo: l.nome,
                valor: extrasDe(l).total / 60,
                texto: formatarHoras(extrasDe(l).total),
                detalhe: `${l.departamento} · ${Object.entries(
                  extrasDe(l).porTipo,
                )
                  .map(([tipo, m]) => `${tipo} ${formatarHoras(m)}`)
                  .join(" · ")}`,
              }))}
            />
          </Secao>
          <Secao
            titulo="Quem mais faltou"
            descricao={`As 10 pessoas com mais horas de falta em ${formatarMes(mes)}`}
          >
            <BarrasHorizontais
              descricao="As 10 pessoas com mais horas de falta"
              vazio="Nenhuma falta no período."
              itens={maisFaltas.map((l) => ({
                chave: l.colaborador_id,
                rotulo: l.nome,
                valor: l.faltas_min / 60,
                texto: formatarHoras(l.faltas_min),
                detalhe: `${l.departamento} · ${formatarNumero(l.faltas_dias, 1)} dia(s) · absenteísmo ${formatarPct(absenteismo(l))}`,
              }))}
            />
          </Secao>
        </div>

        <Secao
          titulo="Faltas por setor"
          descricao={`Horas de falta em ${formatarMes(mes)}, com os dias e o DSR descontado; clique para ver cada pessoa`}
        >
          <BarrasHorizontais
            descricao="Faltas por setor"
            vazio="Nenhuma falta no período."
            itens={[...setores]
              .sort((a, b) => b.faltas_min - a.faltas_min)
              .map((s) => ({
                chave: chaveSetor(s.departamento_id),
                rotulo: s.departamento,
                valor: s.faltas_min / 60,
                texto: formatarHoras(s.faltas_min),
                detalhe: `${formatarNumero(s.faltas_dias, 1)} dia(s) · DSR descontado ${formatarHoras(Math.abs(s.dsr_debito_min))}`,
              }))}
            detalhes={detalheFaltasSetor}
          />
        </Secao>

        <Secao
          titulo="Absenteísmo por funcionário"
          tom="escuro"
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

        <Secao titulo="Por setor" tom="verde">
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
              formatarHoras(totais.extras_min),
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
          extras: soma dos percentuais (Ex80%, Ex100%…) ou a coluna "Extras" nos
          horários sem divisão; a parte noturna (ExNot) já está dentro e as
          extras de intervalo (ExInt) ficam à parte até a confirmação. O valor
          em R$ das extras vem da folha.
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
      <IndicadoresCarregando
        className="sm:grid-cols-2 xl:grid-cols-5"
        quantidade={5}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <CartaoCarregando className="xl:col-span-3" altura="h-80" />
        <CartaoCarregando className="xl:col-span-2" altura="h-80" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CartaoCarregando altura="h-80" />
        <CartaoCarregando altura="h-80" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <CartaoCarregando className="xl:col-span-2" altura="h-80" />
        <CartaoCarregando className="xl:col-span-3" altura="h-80" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CartaoCarregando altura="h-80" />
        <CartaoCarregando altura="h-80" />
      </div>
      <CartaoCarregando />
      <CartaoCarregando />
      <CartaoCarregando />
      <CartaoCarregando />
    </TelaCarregando>
  );
}
