import { ArrowUpRight, Landmark } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import {
  AreaLinha,
  BarrasDivergentes,
  ColunasEspelhadas,
  Faixas,
  Rosca,
} from "@/components/dashboard/graficos";
import {
  AbreDetalhe,
  type Detalhe,
  ProvedorDetalhe,
} from "@/components/modal-detalhe";
import {
  fimDoMes,
  formatarData,
  formatarHoras,
  formatarMes,
  formatarNumero,
  formatarPct,
  ultimasCompetencias,
} from "@/lib/formato";
import { rotuloStatus, type Status, status } from "@/lib/indicadores";
import { paramsDoPeriodo } from "@/lib/periodo";
import { ativosEm, mesesDeCasa, porSetor, somarPonto } from "@/lib/rh/calculos";
import {
  movimentoEntre,
  tabelaDeHorasPerdidas,
  tabelaDeSaidas,
  tabelaDoBanco,
  tabelaDoPonto,
  tabelaDoQuadro,
} from "@/lib/rh/detalhes";
import { avisoDoPonto } from "@/lib/rh/ponto-periodo";
import { empresa } from "@/server/admin/dados";
import { usuarioAtual } from "@/server/auth";
import { avisosDo } from "@/server/avisos";
import {
  colaboradoresDoQuadro,
  folhasImportadas,
  metaDe,
  pontoDoPeriodo,
} from "@/server/rh/dados";
import {
  type Busca,
  type FiltrosDoPeriodo,
  fimConsiderado,
  lerFiltrosDoPeriodo,
} from "@/server/rh/filtros";
import { turnoverDoPeriodo } from "@/server/rh/turnover";

export const metadata: Metadata = { title: "Dashboard" };

const COR_STATUS: Record<Status, string> = {
  ok: "#0ca30c",
  atencao: "#fab219",
  fora: "#d03b3b",
  sem_meta: "#8a8a8a",
  sem_dado: "#8a8a8a",
};

/**
 * Faixas de tempo de casa do gráfico (só agrupam para leitura; não são
 * regra de negócio). "ate" em meses, exclusivo.
 */
const FAIXAS_TEMPO_DE_CASA = [
  { rotulo: "< 1 ano", ate: 12 },
  { rotulo: "1–2 anos", ate: 24 },
  { rotulo: "2–5 anos", ate: 60 },
  { rotulo: "5–10 anos", ate: 120 },
  { rotulo: "10+ anos", ate: Number.POSITIVE_INFINITY },
];

export default function Page({ searchParams }: PageProps<"/gestao">) {
  return (
    <Suspense fallback={<EsqueletoDashboard />}>
      <Dashboard busca={searchParams} />
    </Suspense>
  );
}

/** Ponto de status: cor + texto (nunca só a cor). */
function PontoStatus({ s }: { s: Status }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className="size-2 rounded-full"
        style={{ backgroundColor: COR_STATUS[s] }}
        aria-hidden
      />
      {rotuloStatus(s)}
    </span>
  );
}

async function Dashboard({ busca }: { busca: Promise<Busca> }) {
  const usuario = await usuarioAtual();
  const veRh = usuario.permissoes.some((p) => p.startsWith("rh."));
  const veFinanceiro = usuario.permissoes.some((p) =>
    p.startsWith("financeiro."),
  );
  const [avisos, dadosEmpresa, filtros] = await Promise.all([
    avisosDo(usuario),
    empresa(),
    busca.then((b) => lerFiltrosDoPeriodo(b)),
  ]);
  const primeiroNome = usuario.nome.split(/\s+/)[0];

  return (
    <ProvedorDetalhe>
      <div className="flex flex-col gap-5">
        <Boasvindas
          nome={primeiroNome ?? usuario.nome}
          empresa={dadosEmpresa?.nome ?? "ARP"}
          texto={
            veRh
              ? "Quadro, jornada, banco de horas e movimento de pessoas em um só lugar."
              : veFinanceiro
                ? "Os números do Financeiro entram aqui assim que a API do ENET for liberada."
                : "Seu acesso ainda não foi liberado. Fale com o administrador."
          }
        />

        {veRh && (
          <FiltroPeriodo
            de={filtros.periodo.de}
            ate={filtros.periodo.ate}
            atalho={filtros.periodo.atalho}
            hoje={filtros.hoje}
          />
        )}

        {veRh && (
          <Suspense fallback={<EsqueletoPessoas />}>
            <Pessoas
              filtros={filtros}
              podeFolha={usuario.permissoes.includes("rh.folha")}
              pendencias={avisos.length}
              // Lista de pessoas só para quem já as vê nas telas do RH.
              veJornada={usuario.permissoes.includes("rh.jornada")}
              veQuadro={usuario.permissoes.includes("rh.quadro")}
            />
          </Suspense>
        )}

        {veFinanceiro && (
          <section className="vidro flex flex-wrap items-center gap-4 rounded-[2rem] px-6 py-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-neutral-900 text-white">
              <Landmark className="size-4" aria-hidden />
            </span>
            <p className="min-w-0 flex-1 text-sm text-neutral-600">
              <span className="font-medium text-neutral-900">Financeiro:</span>{" "}
              inadimplência, faturado × recebido, contas a pagar e Performance &
              Capital ganham gráficos aqui quando a API do ENET for liberada.
            </p>
          </section>
        )}
      </div>
    </ProvedorDetalhe>
  );
}

function variacao(
  atual: number | null,
  anterior: number | null,
): string | null {
  if (atual === null || anterior === null) return null;
  const d = atual - anterior;
  return `${d > 0 ? "+" : ""}${formatarNumero(d, 1)} p.p.`;
}

/** Pessoas no período do filtro: quadro do Copiloto e ponto do Secullum. */
async function Pessoas({
  filtros,
  podeFolha,
  pendencias,
  veJornada,
  veQuadro,
}: {
  filtros: FiltrosDoPeriodo;
  podeFolha: boolean;
  pendencias: number;
  veJornada: boolean;
  veQuadro: boolean;
}) {
  const { periodo, anterior, rotulo, mes } = filtros;
  const doze = ultimasCompetencias(mes, 12);
  const [
    colaboradores,
    folhas,
    pontoP,
    pontoAntP,
    metaAbs,
    metaBanco,
    metaTurnover,
    turnover,
  ] = await Promise.all([
    colaboradoresDoQuadro(),
    podeFolha ? folhasImportadas() : Promise.resolve([]),
    pontoDoPeriodo(periodo.de, periodo.ate),
    pontoDoPeriodo(anterior.de, anterior.ate),
    metaDe("rh.absenteismo", mes),
    metaDe("rh.banco_horas_positivo", mes),
    metaDe("rh.turnover", mes),
    // Turnover: direto do Copiloto, no período e nos 12 meses até ele.
    Promise.all([
      turnoverDoPeriodo(periodo.de, periodo.ate),
      turnoverDoPeriodo(doze[0] as string, fimConsiderado(mes)),
    ]),
  ]);

  const aviso = avisoDoPonto(pontoP);
  const ponto = pontoP.linhas;
  const efetivo = pontoP.efetivo ?? periodo;
  const totais = somarPonto(ponto);
  const totaisAnt =
    pontoAntP.linhas.length && !avisoDoPonto(pontoAntP).parcial
      ? somarPonto(pontoAntP.linhas)
      : null;
  const ate = periodo.ate;
  const ativosHoje = ativosEm(colaboradores, ate);
  const ativos = ativosHoje.length;
  const ativosAnt = ativosEm(colaboradores, anterior.ate).length;
  const [doPeriodo, dozeMeses] = turnover;
  const tv = doPeriodo.ok ? doPeriodo.dados : null;
  const doHistorico = new Map(
    dozeMeses.ok ? dozeMeses.dados.mensal.map((m) => [m.competencia, m]) : [],
  );
  // Sem o Copiloto, as contagens saem da lista de pessoas (o turnover não).
  const contagem = (de: string, fim: string) => {
    const m = movimentoEntre(colaboradores, de, fim);
    return {
      admissoes: m.admitidos.length,
      desligamentos: m.desligados.length,
    };
  };
  const movimento = tv ?? contagem(periodo.de, ate);
  const qs = (dep?: string | null) =>
    new URLSearchParams({
      ...paramsDoPeriodo(periodo),
      ...(dep ? { dep } : {}),
    }).toString();
  const evolucao = doze.map((c) => {
    const n = ativosEm(colaboradores, fimConsiderado(c)).length;
    return {
      chave: c,
      rotulo: formatarMes(c).slice(0, 3),
      titulo: formatarMes(c),
      valor: n,
      texto: String(n),
      destaque: c === mes,
    };
  });
  const fluxo = doze.map((c) => {
    const m = doHistorico.get(c) ?? contagem(c, fimConsiderado(c));
    return {
      chave: c,
      rotulo: formatarMes(c).slice(0, 3),
      titulo: formatarMes(c),
      acima: m.admissoes,
      abaixo: m.desligamentos,
      destaque: c === mes,
    };
  });
  const admissoes12 = fluxo.reduce((s, f) => s + f.acima, 0);
  const desligamentos12 = fluxo.reduce((s, f) => s + f.abaixo, 0);
  const comAdmissao = ativosHoje
    .filter((c) => c.admissao !== null)
    .map((c) => ({ c, meses: mesesDeCasa(c.admissao as string, ate) }));
  const tempos = comAdmissao.map((x) => x.meses);
  const naFaixa = (k: number) => {
    const de = FAIXAS_TEMPO_DE_CASA[k - 1]?.ate ?? 0;
    const ateFaixa = FAIXAS_TEMPO_DE_CASA[k]?.ate ?? 0;
    return comAdmissao
      .filter((x) => x.meses >= de && x.meses < ateFaixa)
      .sort((a, b) => b.meses - a.meses)
      .map((x) => x.c);
  };
  const tempoDeCasa = FAIXAS_TEMPO_DE_CASA.map((f, k) => {
    const n = naFaixa(k).length;
    return {
      chave: f.rotulo,
      rotulo: f.rotulo,
      valor: n,
      texto: String(n),
      titulo: `${f.rotulo} de casa`,
      detalhe: `${n === 1 ? "pessoa" : "pessoas"}, ${formatarPct(tempos.length ? (n / tempos.length) * 100 : null)} do quadro`,
    };
  });
  const medianaCasa = [...tempos].sort((a, b) => a - b)[
    Math.floor(tempos.length / 2)
  ];
  const setores = porSetor(ponto);
  const maxAbs = Math.max(...setores.map((s) => s.absenteismo ?? 0), 1);
  const ultimaFolha = folhas[0];
  const varAbs = variacao(totais.absenteismo, totaisAnt?.absenteismo ?? null);

  // Quem forma cada número (modal ao clicar). Ponto: só com rh.jornada;
  // cadastro e movimento: só com rh.quadro.
  const doSetor = (id: string | null) =>
    ponto.filter((l) => l.departamento_id === id);
  const linkJornada = (dep?: string | null) => `/rh/jornada?${qs(dep)}`;
  const detalhesDoMes = (c: string): Detalhe => {
    const fim = fimConsiderado(c);
    const lista = ativosEm(colaboradores, fim);
    const { admitidos, desligados } = movimentoEntre(
      colaboradores,
      c,
      fimDoMes(c),
    );
    const m = doHistorico.get(c);
    return {
      secao: "Quadro",
      titulo: `Pessoas em ${formatarMes(c)}`,
      subtitulo: `Copiloto RH em ${formatarData(fim)}`,
      resumo: [
        { rotulo: "Ativos", valor: String(lista.length) },
        {
          rotulo: "Admissões",
          valor: String(m?.admissoes ?? admitidos.length),
        },
        {
          rotulo: "Desligamentos",
          valor: String(m?.desligamentos ?? desligados.length),
        },
        { rotulo: "Turnover", valor: formatarPct(m?.turnover ?? null) },
      ],
      tabelas: [
        {
          ...tabelaDoQuadro(admitidos, fim, "Admitidos no mês"),
          vazio: "Nenhuma admissão no mês.",
        },
        {
          ...tabelaDeSaidas(desligados, "Desligados no mês"),
          vazio: "Nenhum desligamento no mês.",
        },
        tabelaDoQuadro(lista, fim, "Ativos no fim do mês"),
      ],
      link: {
        href: `/rh/quadro?mes=${c.slice(0, 7)}`,
        rotulo: "Abrir Quadro e turnover",
      },
    };
  };
  const detMeses: Record<string, Detalhe> | undefined = veQuadro
    ? Object.fromEntries(doze.map((c) => [c, detalhesDoMes(c)]))
    : undefined;
  const detSetores: Record<string, Detalhe> | undefined = veJornada
    ? Object.fromEntries(
        setores.map((s) => [
          s.departamento_id ?? "sem",
          {
            secao: "Pessoas por setor",
            titulo: s.departamento,
            subtitulo: `Ponto de ${formatarData(efetivo.de)} a ${formatarData(efetivo.ate)}, do maior absenteísmo para o menor`,
            resumo: [
              { rotulo: "Pessoas", valor: String(s.colaboradores) },
              { rotulo: "Absenteísmo", valor: formatarPct(s.absenteismo) },
              { rotulo: "Faltas", valor: formatarHoras(s.faltas_min) },
              { rotulo: "Atrasos", valor: formatarHoras(s.atrasos_min) },
            ],
            tabelas: [tabelaDoPonto(doSetor(s.departamento_id))],
            link: {
              href: linkJornada(s.departamento_id),
              rotulo: "Abrir a Jornada do setor",
            },
          } satisfies Detalhe,
        ]),
      )
    : undefined;
  const detBanco: Record<string, Detalhe> | undefined = veJornada
    ? Object.fromEntries(
        setores.map((s) => [
          s.departamento_id ?? "sem",
          {
            secao: "Banco de horas",
            titulo: s.departamento,
            subtitulo: `Saldo de cada pessoa em ${rotulo}, de quem mais deve para quem mais tem crédito`,
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
            link: {
              href: linkJornada(s.departamento_id),
              rotulo: "Abrir a Jornada do setor",
            },
          } satisfies Detalhe,
        ]),
      )
    : undefined;
  const detTempo: Record<string, Detalhe> | undefined = veQuadro
    ? Object.fromEntries(
        FAIXAS_TEMPO_DE_CASA.map((f, k) => [
          f.rotulo,
          {
            secao: "Tempo de casa",
            titulo: f.rotulo,
            subtitulo: `Ativos em ${formatarData(ate)}, de quem está há mais tempo`,
            tabelas: [tabelaDoQuadro(naFaixa(k), ate)],
            link: {
              href: `/rh/quadro?${qs()}`,
              rotulo: "Abrir Quadro e turnover",
            },
          } satisfies Detalhe,
        ]),
      )
    : undefined;
  const detHoras: Record<string, Detalhe> | undefined = veJornada
    ? Object.fromEntries(
        (["faltas", "atrasos"] as const).map((motivo) => [
          motivo,
          {
            secao: "Horas perdidas",
            titulo: motivo === "faltas" ? "Faltas" : "Atrasos",
            subtitulo: `Quem teve ${motivo} em ${rotulo}, da maior para a menor`,
            resumo: [
              {
                rotulo: "Total",
                valor: formatarHoras(
                  motivo === "faltas" ? totais.faltas_min : totais.atrasos_min,
                ),
              },
              {
                rotulo: "Pessoas",
                valor: String(
                  ponto.filter((l) =>
                    motivo === "faltas" ? l.faltas_min > 0 : l.atrasos_min > 0,
                  ).length,
                ),
              },
            ],
            tabelas: [tabelaDeHorasPerdidas(ponto, motivo)],
            link: { href: linkJornada(), rotulo: "Abrir a Jornada" },
          } satisfies Detalhe,
        ]),
      )
    : undefined;
  const bancoPositivo = tabelaDoBanco(
    ponto.filter((l) => l.banco_saldo_min > 0),
  );
  const detIndicadores = {
    absenteismo: veJornada
      ? ({
          secao: "Absenteísmo",
          titulo: `Absenteísmo de ${rotulo}`,
          subtitulo: "Faltas e atrasos ÷ horas previstas, por pessoa",
          resumo: [
            { rotulo: "Absenteísmo", valor: formatarPct(totais.absenteismo) },
            { rotulo: "Faltas", valor: formatarHoras(totais.faltas_min) },
            { rotulo: "Atrasos", valor: formatarHoras(totais.atrasos_min) },
            { rotulo: "Pessoas", valor: String(ponto.length) },
          ],
          tabelas: [tabelaDoPonto(ponto)],
          link: { href: linkJornada(), rotulo: "Abrir a Jornada" },
        } satisfies Detalhe)
      : undefined,
    banco: veJornada
      ? ({
          secao: "Banco de horas",
          titulo: "Banco positivo",
          subtitulo: `Quem tem horas a folgar ou receber em ${rotulo}`,
          resumo: [
            {
              rotulo: "Total",
              valor: `+${formatarHoras(totais.banco_positivo_min)}`,
            },
            { rotulo: "Pessoas", valor: String(bancoPositivo.linhas.length) },
          ],
          tabelas: [
            { ...bancoPositivo, linhas: [...bancoPositivo.linhas].reverse() },
          ],
          link: { href: linkJornada(), rotulo: "Abrir a Jornada" },
        } satisfies Detalhe)
      : undefined,
  };

  return (
    <>
      {(aviso.semDado || aviso.parcial) && (
        <p className="vidro rounded-2xl px-5 py-3 text-sm text-neutral-600">
          <span className="font-medium text-neutral-900">Ponto: </span>
          {aviso.semDado ?? aviso.parcial}
        </p>
      )}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Visão geral: cartão de destaque com os números do período. */}
        <section className="destaque flex flex-col gap-6 rounded-[2rem] p-6 xl:col-span-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Visão geral</h2>
            <span className="ladrilho rounded-full px-3 py-1 text-xs">
              {rotulo}
            </span>
          </div>

          <div className="flex items-end gap-6">
            <AbreDetalhe
              detalhe={detMeses?.[mes]}
              className="-m-2 rounded-2xl p-2 hover:bg-[rgb(255_255_255/0.06)]"
            >
              <p className="text-6xl font-semibold tracking-tight">{ativos}</p>
              <p className="mt-1 text-sm text-[rgb(255_255_255/0.6)]">
                headcount · colaboradores ativos
              </p>
            </AbreDetalhe>
            <div
              className="mb-2 h-12 w-px bg-[rgb(255_255_255/0.15)]"
              aria-hidden
            />
            <div>
              <p className="text-4xl font-semibold tracking-tight">
                {pendencias}
              </p>
              <p className="mt-1 text-sm text-[rgb(255_255_255/0.6)]">
                pendências (no sino)
              </p>
            </div>
          </div>

          <div className="h-1 w-16 rounded-full bg-marca" aria-hidden />

          <div className="grid grid-cols-3 gap-3">
            <AbreDetalhe
              detalhe={detIndicadores.absenteismo}
              className="ladrilho rounded-2xl p-3 hover:bg-[rgb(255_255_255/0.1)]"
            >
              <p className="text-[11px] text-[rgb(255_255_255/0.6)]">
                Absenteísmo
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {formatarPct(totais.absenteismo)}
              </p>
              <div className="mt-1 text-[rgb(255_255_255/0.75)]">
                <PontoStatus s={status(totais.absenteismo, metaAbs)} />
              </div>
              {varAbs && (
                <p className="mt-1 text-[11px] text-[rgb(255_255_255/0.45)]">
                  {varAbs} no mês
                </p>
              )}
            </AbreDetalhe>
            <AbreDetalhe
              detalhe={detIndicadores.banco}
              className="ladrilho rounded-2xl p-3 hover:bg-[rgb(255_255_255/0.1)]"
            >
              <p className="text-[11px] text-[rgb(255_255_255/0.6)]">
                Banco positivo
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {formatarHoras(totais.banco_positivo_min)}
              </p>
              <div className="mt-1 text-[rgb(255_255_255/0.75)]">
                <PontoStatus
                  s={status(
                    ponto.length ? totais.banco_positivo_min / 60 : null,
                    metaBanco,
                  )}
                />
              </div>
            </AbreDetalhe>
            <AbreDetalhe
              detalhe={detMeses?.[mes]}
              className="ladrilho rounded-2xl p-3 hover:bg-[rgb(255_255_255/0.1)]"
            >
              <p className="text-[11px] text-[rgb(255_255_255/0.6)]">
                Turnover
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {formatarPct(tv?.turnover ?? null)}
              </p>
              <div className="mt-1 text-[rgb(255_255_255/0.75)]">
                {tv ? (
                  <PontoStatus s={status(tv.turnover, metaTurnover)} />
                ) : (
                  <span
                    className="line-clamp-2 break-words text-xs"
                    title={doPeriodo.ok ? undefined : doPeriodo.motivo}
                  >
                    {doPeriodo.ok ? "" : doPeriodo.motivo}
                  </span>
                )}
              </div>
            </AbreDetalhe>
          </div>
        </section>

        {/* Evolução do quadro: área suave em vidro. */}
        <section className="vidro flex flex-col gap-4 rounded-[2rem] p-6 xl:col-span-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Evolução do headcount</h2>
              <p className="text-xs text-neutral-500">
                Colaboradores ativos no fim de cada mês
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-neutral-900 px-3 py-1 text-white">
                {ativos - ativosAnt >= 0 ? "+" : ""}
                {ativos - ativosAnt} vs {formatarData(anterior.ate)}
              </span>
              <span className="rounded-full border border-neutral-200 px-3 py-1 text-neutral-600">
                {movimento.admissoes} admissões
              </span>
              <span className="rounded-full border border-neutral-200 px-3 py-1 text-neutral-600">
                {movimento.desligamentos} desligamentos
              </span>
            </div>
          </div>
          <AreaLinha
            className="mt-auto"
            itens={evolucao}
            detalhes={detMeses}
            descricao="Colaboradores ativos no fim de cada mês, últimos 12 meses"
          />
        </section>
      </div>

      {/* Pessoas por setor: cartão preto largo, uma coluna por setor. */}
      <section className="tom-escuro rounded-[2rem] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Pessoas por setor
            </h2>
            <p className="text-xs text-neutral-500">
              Ponto de {formatarData(mes)} a {formatarData(ate)}
              {ultimaFolha
                ? ` · última folha: ${formatarMes(ultimaFolha.competencia)}`
                : ""}
            </p>
          </div>
          <Link
            href="/rh"
            className="inline-flex items-center gap-2 rounded-full border border-neutral-900/10 bg-neutral-900/[0.08] px-4 py-2 text-sm transition hover:bg-neutral-900/[0.14]"
          >
            Abrir o RH <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3 md:divide-x md:divide-neutral-900/10">
          {setores.map((s) => (
            <AbreDetalhe
              key={s.departamento_id ?? "sem"}
              detalhe={detSetores?.[s.departamento_id ?? "sem"]}
              className="flex flex-col gap-4 rounded-2xl p-2 hover:bg-neutral-900/[0.06] md:px-4 md:first:pl-2"
            >
              <div>
                <p className="text-base font-semibold">{s.departamento}</p>
                <p className="text-xs text-neutral-500">
                  {s.colaboradores} pessoas no ponto
                </p>
              </div>
              <div>
                <div className="flex items-baseline justify-between text-xs text-neutral-600">
                  <span>Absenteísmo</span>
                  <span className="text-sm font-semibold text-neutral-900">
                    {formatarPct(s.absenteismo)}
                  </span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-neutral-900/10">
                  <div
                    className="h-full rounded-full bg-neutral-900"
                    style={{
                      width: `${Math.max(((s.absenteismo ?? 0) / maxAbs) * 100, 2)}%`,
                    }}
                  />
                </div>
              </div>
              <div className="flex gap-4 text-xs text-neutral-600">
                <span>
                  Faltas{" "}
                  <b className="font-semibold text-neutral-900">
                    {formatarHoras(s.faltas_min)}
                  </b>
                </span>
                <span>
                  Banco{" "}
                  <b className="font-semibold text-neutral-900">
                    {formatarHoras(s.banco_saldo_min)}
                  </b>
                </span>
              </div>
            </AbreDetalhe>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Movimento de pessoas: admissões ↑ e desligamentos ↓ por mês. */}
        <section className="vidro flex flex-col gap-4 rounded-[2rem] p-6 xl:col-span-5">
          <div>
            <h2 className="text-lg font-semibold">Movimento de pessoas</h2>
            <p className="text-xs text-neutral-500">
              Últimos 12 meses: {admissoes12} admissões e {desligamentos12}{" "}
              desligamentos
            </p>
          </div>
          <ColunasEspelhadas
            itens={fluxo}
            detalhes={detMeses}
            rotulos={{ acima: "Admissões", abaixo: "Desligamentos" }}
            descricao="Admissões e desligamentos por mês, últimos 12 meses"
          />
        </section>

        {/* Banco de horas: débitos ← zero → créditos, por setor. */}
        <section className="destaque flex flex-col gap-5 rounded-[2rem] p-6 xl:col-span-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Banco de horas</h2>
              <p className="text-xs text-[rgb(255_255_255/0.6)]">
                Saldos do ponto por setor em {rotulo}
              </p>
            </div>
            <span className="ladrilho rounded-full px-3 py-1 text-xs">
              Saldo da empresa{" "}
              <b className="font-semibold">
                {formatarHoras(totais.banco_saldo_min)}
              </b>
            </span>
          </div>
          <BarrasDivergentes
            escuro
            detalhes={detBanco}
            descricao="Banco de horas por setor: débitos e créditos"
            rotulos={{
              negativo: "Débito (pessoas devem horas)",
              positivo: "Crédito (horas a folgar ou pagar)",
            }}
            linhas={setores.map((s) => ({
              chave: s.departamento_id ?? "sem",
              rotulo: s.departamento,
              negativo: Math.abs(s.banco_negativo_min),
              positivo: s.banco_positivo_min,
              textoNegativo: formatarHoras(-Math.abs(s.banco_negativo_min)),
              textoPositivo: `+${formatarHoras(s.banco_positivo_min)}`,
              resumo: `saldo ${formatarHoras(s.banco_saldo_min)}`,
              detalhe: `${s.colaboradores} pessoas · crédito +${formatarHoras(s.banco_positivo_min)} · débito ${formatarHoras(-Math.abs(s.banco_negativo_min))}`,
            }))}
          />
          <dl className="mt-auto grid grid-cols-2 gap-3 sm:grid-cols-4">
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
                valor: `${ponto.filter((l) => l.banco_saldo_min < 0).length} pessoas`,
              },
              {
                rotulo: "Têm crédito",
                valor: `${ponto.filter((l) => l.banco_saldo_min > 0).length} pessoas`,
              },
            ].map((t) => (
              <div key={t.rotulo} className="ladrilho rounded-2xl p-3">
                <dt className="text-[11px] text-[rgb(255_255_255/0.6)]">
                  {t.rotulo}
                </dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums">
                  {t.valor}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <section className="tom-verde flex flex-col gap-4 rounded-[2rem] p-6 xl:col-span-7">
          <div>
            <h2 className="text-lg font-semibold">Tempo de casa</h2>
            <p className="text-xs text-neutral-500">
              Ativos em {formatarData(ate)} por faixa
              {medianaCasa !== undefined
                ? ` · metade está há até ${formatarNumero(medianaCasa / 12, 1)} anos`
                : ""}
            </p>
          </div>
          <Faixas
            className="flex-1"
            itens={tempoDeCasa}
            detalhes={detTempo}
            descricao="Colaboradores ativos por faixa de tempo de casa"
          />
        </section>

        <section className="vidro flex flex-col gap-4 rounded-[2rem] p-6 xl:col-span-5">
          <div>
            <h2 className="text-lg font-semibold">Horas perdidas</h2>
            <p className="text-xs text-neutral-500">
              O que forma o absenteísmo de {rotulo}
            </p>
          </div>
          <Rosca
            detalhes={detHoras}
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
          />
        </section>
      </div>
    </>
  );
}

/**
 * Banner de boas-vindas: fachada do Espaço ARP (letreiro à direita, à
 * mostra) levemente desfocada, sob um degradê preto à esquerda, onde fica o
 * texto. Escuro nos dois temas.
 */
function Boasvindas({
  nome,
  empresa,
  texto,
}: {
  nome: string;
  empresa: string;
  texto: string;
}) {
  return (
    <header className="relative isolate overflow-hidden rounded-[2rem] px-6 py-10 text-[#fff] shadow-[0_24px_50px_-28px_rgb(0_0_0/0.55)] md:px-10 md:py-12">
      <Image
        src="/brand/banner-gestao.webp"
        alt=""
        fill
        priority
        sizes="(min-width: 768px) 75vw, 100vw"
        className="-z-30 scale-105 object-cover object-[center_calc(36%_-_10px)] blur-[2px]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-20 bg-[linear-gradient(100deg,#0a0a0a_0%,rgb(10_10_10/0.92)_30%,rgb(10_10_10/0.55)_55%,rgb(10_10_10/0.12)_100%)]"
      />
      <p className="text-xs font-semibold tracking-[0.2em] text-[#8fd99b] uppercase">
        Gestão · {empresa}
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
        Olá, {nome}
      </h1>
      <p className="mt-3 max-w-xl text-sm text-[rgb(255_255_255/0.82)] md:text-base">
        {texto}
      </p>
    </header>
  );
}

/** Blocos no lugar das boas-vindas e dos cartões de pessoas. */
function EsqueletoDashboard() {
  return (
    <TelaCarregando>
      <CartaoCarregando altura="h-56" />
      <CartoesPessoasCarregando />
    </TelaCarregando>
  );
}

/** Blocos no lugar dos cartões de pessoas enquanto os dados chegam. */
function EsqueletoPessoas() {
  return (
    <TelaCarregando>
      <CartoesPessoasCarregando />
    </TelaCarregando>
  );
}

function CartoesPessoasCarregando() {
  return (
    <>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <CartaoCarregando className="xl:col-span-5" altura="h-80" />
        <CartaoCarregando className="xl:col-span-7" altura="h-80" />
      </div>
      <CartaoCarregando altura="h-72" />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <CartaoCarregando className="xl:col-span-5" altura="h-80" />
        <CartaoCarregando className="xl:col-span-7" altura="h-80" />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <CartaoCarregando className="xl:col-span-7" altura="h-80" />
        <CartaoCarregando className="xl:col-span-5" altura="h-80" />
      </div>
    </>
  );
}
