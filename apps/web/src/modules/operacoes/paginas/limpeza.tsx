import {
  formatarData,
  formatarDataHora,
  ultimasCompetencias,
} from "@arp/shared/formato";
import type { ResumoDoMes } from "@arp/shared/operacoes/contratos/limpeza";
import {
  calcularRateio,
  lerMes,
  mesAnterior,
  mesSeguinte,
  nomeDoMes,
  ROTULO_REGRA_BL04,
  valoresPorLocal,
} from "@arp/shared/operacoes/limpeza";
import {
  lancamentoDasLinhas,
  textoDeCentavos,
} from "@arp/shared/operacoes/limpeza-lancamento";
import {
  diferencasComPlanilha,
  rotuloDoLocal,
} from "@arp/shared/operacoes/limpeza-planilha";
import { useSuspenseQueries } from "@tanstack/react-query";
import { Suspense, useMemo } from "react";
import { z } from "zod";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { Secao } from "@/components/dashboard/tabela";
import { TopoDaTela } from "@/components/dashboard/tela";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { useParametrosDeBusca } from "@/lib/navegacao";
import { AnexosDoMes } from "@/modules/operacoes/components/limpeza/anexos";
import {
  SeloEnvio,
  SeloMes,
} from "@/modules/operacoes/components/limpeza/campos";
import { GraficoDoRateio } from "@/modules/operacoes/components/limpeza/grafico";
import { HistoricoDoRateio } from "@/modules/operacoes/components/limpeza/historico";
import { RateioDoMes } from "@/modules/operacoes/components/limpeza/rateio";
import { SeletorDeMes } from "@/modules/operacoes/components/limpeza/seletor-mes";
import { consultaDosParametros } from "../api";
import {
  consultaDoMesDoRateio,
  consultaDosMesesDoRateio,
  hrefDoDemonstrativo,
} from "../api-limpeza";
import { useContextoOp } from "../contexto";

const extrasPadrao = z
  .array(
    z.object({
      descricao: z.string().trim().min(1),
      valor_dia: z.coerce.number().nonnegative(),
    }),
  )
  .catch([]);

export default function Page() {
  return (
    <>
      <PageHeader
        title="Rateio da limpeza"
        description="O custo da limpeza contratada dividido entre a área comum e os blocos, igual à planilha, com a memória de cálculo de cada valor."
      />
      <Suspense fallback={<Esqueleto />}>
        <Tela />
      </Suspense>
    </>
  );
}

function Tela() {
  const ctx = useContextoOp();
  if (!PERMISSOES_RATEIO.some((p) => ctx.pode(p))) return <SemAcesso />;
  return <Rateio />;
}

const PERMISSOES_RATEIO = [
  "operacoes.limpeza.ver",
  "operacoes.limpeza.fechar",
] as const;

function Rateio() {
  const sp = useParametrosDeBusca();
  // Os parâmetros já vêm junto: o mês os usa (prazo, empresa e extras).
  const [{ data: m, dataUpdatedAt }] = useSuspenseQueries({
    queries: [consultaDosMesesDoRateio, consultaDosParametros],
  });
  const ctx = useContextoOp(dataUpdatedAt);
  const meses = m.meses;
  const podeLancar = ctx.pode("operacoes.limpeza.fechar");
  const pedido = lerMes(sp.get("mes"));
  const atual =
    pedido && meses.some((m) => m.referencia === pedido)
      ? pedido
      : (meses[0]?.referencia ?? null);
  const resumo = meses.find((x) => x.referencia === atual);
  const sugestao = (
    meses[0]
      ? mesSeguinte(meses[0].referencia)
      : mesAnterior(`${ctx.hoje.slice(0, 7)}-01`)
  ).slice(0, 7);

  const seletor = (
    <SeletorDeMes
      meses={meses.map((m) => ({
        referencia: m.referencia,
        rotulo: `${nomeDoMes(m.referencia)}${m.status === "aberto" ? (m.incompleto ? " · incompleto" : " · aberto") : ""}`,
      }))}
      atual={atual}
      podeLancar={podeLancar}
      sugestao={sugestao}
    />
  );

  if (!atual || !resumo)
    return (
      <NenhumMes
        seletor={seletor}
        pedido={pedido}
        atual={atual}
        podeLancar={podeLancar}
      />
    );
  return (
    <Mes
      atual={atual}
      resumo={resumo}
      meses={meses}
      seletor={seletor}
      pedido={pedido}
      podeLancar={podeLancar}
    />
  );
}

function NenhumMes({
  seletor,
  pedido,
  atual,
  podeLancar,
}: {
  seletor: React.ReactNode;
  pedido: string | null;
  atual: string | null;
  podeLancar: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      {seletor}
      <Secao titulo="Nenhum mês lançado">
        <p className="text-sm text-neutral-600">
          {pedido && pedido !== atual
            ? `O rateio de ${nomeDoMes(pedido)} ainda não foi lançado. `
            : ""}
          O rateio depende do lançamento do mês (valor base do contrato,
          funcionários, extras e minutos por bloco) ou da importação do
          histórico da planilha em Operações › Importações.
          {podeLancar ? " Use “Novo mês” para começar." : ""}
        </p>
      </Secao>
    </div>
  );
}

function Mes({
  atual,
  resumo,
  meses,
  seletor,
  pedido,
  podeLancar,
}: {
  atual: string;
  resumo: ResumoDoMes;
  meses: ResumoDoMes[];
  seletor: React.ReactNode;
  pedido: string | null;
  podeLancar: boolean;
}) {
  const [{ data: r, dataUpdatedAt }, { data: p }] = useSuspenseQueries({
    queries: [consultaDoMesDoRateio(atual), consultaDosParametros],
  });
  const ctx = useContextoOp(dataUpdatedAt);
  const param = p.parametros;
  const d = r.detalhe;
  const resultado = useMemo(() => (d ? calcularRateio(d.entrada) : null), [d]);
  if (!d || !resultado)
    return (
      <NenhumMes
        seletor={seletor}
        pedido={pedido}
        atual={atual}
        podeLancar={podeLancar}
      />
    );

  const regra = d.entrada.regraBl04;
  const rotuloMes = nomeDoMes(atual);
  const linhaFiltros = `Mês: ${rotuloMes} · ${ROTULO_REGRA_BL04[regra]}`;
  const diferencas =
    d.mes.origem === "importacao" && !d.mes.incompleto
      ? diferencasComPlanilha(
          d.mes.valores_planilha,
          valoresPorLocal(resultado, regra),
        )
      : [];
  const quando = (p: { nome: string; em: string | null } | null) =>
    p ? `${p.nome}${p.em ? ` em ${formatarDataHora(p.em)}` : ""}` : null;
  const pontos = ultimasCompetencias(atual, 12).map((ref) => {
    const m = meses.find((x) => x.referencia === ref);
    return {
      referencia: ref,
      rotulo: nomeDoMes(ref).replace(/\/\d{2}(\d{2})$/, "/$1"),
      titulo: nomeDoMes(ref),
      total: m?.total ?? null,
      areaComum: m?.areaComum ?? null,
      blocos: m?.blocos ?? {},
    };
  });
  const lancamento = lancamentoDasLinhas(
    atual,
    d.mes,
    d.extras,
    d.minutos,
    d.contrato,
    d.equipe,
    d.blocos,
  );

  return (
    <div className="flex flex-col gap-6">
      {seletor}
      <TopoDaTela
        dadosDe={ctx.dadosDe}
        filtros={linhaFiltros}
        exemplo={d.mes.exemplo ? "meses do rateio de exemplo" : undefined}
      />

      <div
        data-guia="op-limpeza-situacao"
        className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-neutral-600"
      >
        <span className="inline-flex items-center gap-2">
          <SeloMes status={resumo.status} incompleto={resumo.incompleto} />
          {d.fechou && (
            <span className="text-xs">Fechado por {quando(d.fechou)}</span>
          )}
        </span>
        <span className="inline-flex flex-wrap items-center gap-2">
          <SeloEnvio situacao={resumo.envio} />
          <span className="text-xs">
            {d.enviou
              ? `por ${quando(d.enviou)}`
              : resumo.envio === "historico"
                ? "Mês da planilha, repassado fora do sistema"
                : `Prazo: ${param.limpeza_dia_util_envio}º dia útil de ${nomeDoMes(mesSeguinte(atual))} (${formatarData(resumo.prazo)})`}
          </span>
        </span>
        <span className="text-xs">
          Empresa: {param.limpeza_empresa}
          {d.mes.origem === "importacao"
            ? ` · Importado da planilha${d.mes.valores_planilha && typeof d.mes.valores_planilha === "object" && "aba" in d.mes.valores_planilha ? ` (aba "${String(d.mes.valores_planilha.aba)}")` : ""}`
            : ""}
        </span>
        {d.reabriu && (
          <span className="text-xs">
            Reaberto por {quando(d.reabriu)}: &ldquo;{d.reabriu.motivo}&rdquo;
          </span>
        )}
      </div>

      <RateioDoMes
        key={`${atual}:${d.mes.atualizado_em}`}
        lancamento={lancamento}
        rotuloMes={rotuloMes}
        blocos={d.blocos}
        regra={regra}
        status={resumo.status}
        podeLancar={podeLancar}
        quem={{
          lancou: quando(d.lancou),
          fechou: quando(d.fechou),
          enviou: quando(d.enviou),
          enviado: !!d.enviou,
        }}
        extrasPadrao={extrasPadrao
          .parse(param.limpeza_extras_padrao)
          .map((x) => ({
            descricao: x.descricao,
            valorDia: textoDeCentavos(Math.round(x.valor_dia * 100)),
          }))}
        hrefDemonstrativo={hrefDoDemonstrativo(atual)}
        diferencasPlanilha={diferencas.map((x) => ({
          ...x,
          rotulo: rotuloDoLocal(x.local),
        }))}
        exportar={ctx.pode("operacoes.exportar")}
        linhaDeFiltros={`${linhaFiltros} · ${ctx.dadosDe}`}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Secao
          titulo="Anexos do mês"
          descricao="Medição ou nota da empresa e o apontamento de minutos. Os envios ao Financeiro também ficam aqui."
        >
          <AnexosDoMes
            referencia={atual}
            anexos={d.anexos.map((a) => ({
              id: a.id,
              nome: a.nome,
              tipo: a.tipo,
              enviadoEm: a.enviado_em,
              enviadoPor: a.enviadoPor,
            }))}
            podeEnviar={podeLancar}
            podeRemover={podeLancar && resumo.status === "aberto"}
          />
        </Secao>
        <Secao
          titulo="Valor por local · últimos 12 meses"
          descricao="Escolha o local. O mês da tela fica em destaque."
        >
          <GraficoDoRateio pontos={pontos} blocos={d.blocos} atual={atual} />
        </Secao>
      </div>

      <Secao
        titulo="Histórico dos meses"
        descricao="Cada mês como foi calculado, com a situação, a conferência e o envio ao Financeiro."
      >
        <HistoricoDoRateio meses={meses} atual={atual} />
      </Secao>
    </div>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <IndicadoresCarregando
        className="sm:grid-cols-2 xl:grid-cols-4"
        quantidade={4}
      />
      <CartaoCarregando altura="h-[32rem]" />
    </TelaCarregando>
  );
}
