import { TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { SeloStatus } from "@/components/dashboard/indicador";
import { AbaCalendario } from "@/components/marketing/radar/calendario";
import { BASE_RADAR, type PropsAba } from "@/components/marketing/radar/comum";
import { AbaRonda } from "@/components/marketing/radar/ronda";
import { AbaTarefas } from "@/components/marketing/radar/tarefas";
import { AbasMkt, hrefCom } from "@/components/marketing/tela";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { formatarDataHora } from "@/lib/formato";
import {
  eventosDoCalendario,
  fimDoMes,
  limiteDaRegra,
  mesesAFrente,
  sinalizacoesDoMarketing,
  tarefasDoTime,
} from "@/lib/marketing/radar";
import {
  parametros,
  regrasAlerta,
  temasEcodigos,
} from "@/server/marketing/base";
import { type Busca, lerFiltros } from "@/server/marketing/filtros";
import { dadosAsana } from "@/server/marketing/fontes";

export const metadata: Metadata = { title: "Radar operacional" };

export default function Page({ searchParams }: PageProps<"/marketing/radar">) {
  return (
    <>
      <PageHeader
        title="Radar operacional"
        description="O que o Marketing procura à mão no Asana: tarefas do time, calendário de eventos e as sinalizações da ronda que são do Marketing."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="marketing.radar">
          <Tela busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

const ABAS = [
  { chave: "tarefas", rotulo: "Tarefas do time" },
  { chave: "calendario", rotulo: "Calendário de eventos" },
  { chave: "ronda", rotulo: "Sinalizações da ronda" },
] as const;
type Aba = (typeof ABAS)[number]["chave"];

async function Tela({ busca }: { busca: Promise<Busca> }) {
  const url = await busca;
  // A agenda do site era uma aba daqui; o link antigo vai para a tela nova.
  if (url.aba === "site") redirect("/marketing/eventos");
  const f = await lerFiltros("radar", url, "mes");
  const { ctx } = f;
  const hoje = ctx.hoje;
  const aba: Aba = ABAS.some((a) => a.chave === f.um("aba"))
    ? (f.um("aba") as Aba)
    : "tarefas";

  const [asana, params, { codigos }, regras] = await Promise.all([
    dadosAsana(),
    parametros(),
    temasEcodigos(),
    regrasAlerta(),
  ]);
  const sinalizacoes = sinalizacoesDoMarketing(
    asana.tarefas,
    params.asana_projeto_ronda,
    codigos,
    hoje,
  );
  const abertas = sinalizacoes.filter((s) => !s.concluida).length;
  const limite = limiteDaRegra(regras, "sinalizacoes_abertas");
  const urgente = limite !== null && abertas > limite;

  const p: PropsAba = {
    busca: f.busca,
    lembrado: f.lembrado,
    hoje,
    dadosDe: asana.lidoEm
      ? `Asana lido em ${formatarDataHora(asana.lidoEm)}`
      : "Asana não lido",
    exportar: ctx.pode("marketing.exportar"),
    um: f.um,
  };
  // Trocar de aba começa a outra sem filtros. A aba vai sempre na URL: sem
  // nada nela, a tela voltaria aos filtros lembrados (talvez de outra aba).
  const hrefAba = (chave: Aba) => hrefCom(BASE_RADAR, {}, { aba: chave });

  const meses = mesesAFrente(hoje, 6);

  return (
    <div className="flex flex-col gap-6">
      <AbasMkt
        rotulo="Abas do Radar operacional"
        ativa={aba}
        abas={ABAS.map((a) => ({
          chave: a.chave,
          rotulo: a.rotulo,
          href: hrefAba(a.chave),
          aviso: a.chave === "ronda" && urgente ? "Urgente" : undefined,
        }))}
      />

      {urgente && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          <SeloStatus status="fora" rotulo="Urgente" />
          <span>
            {abertas} sinalizações do Marketing abertas, acima do limite de{" "}
            {limite} (regra de alerta em Configurações).
          </span>
          {aba !== "ronda" && (
            <Link
              href={hrefAba("ronda")}
              className="font-medium underline underline-offset-4"
            >
              Ver sinalizações
            </Link>
          )}
        </div>
      )}

      {asana.aviso && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{asana.aviso}</p>
        </div>
      )}

      {aba === "tarefas" && (
        <AbaTarefas
          p={p}
          linhas={tarefasDoTime(
            asana.tarefas,
            params.asana_projetos_marketing,
            hoje,
          )}
          projetos={params.asana_projetos_marketing}
          diasAtrasoAlerta={limiteDaRegra(regras, "tarefa_atrasada")}
        />
      )}
      {aba === "calendario" && (
        <AbaCalendario
          p={p}
          meses={meses}
          eventos={eventosDoCalendario(
            asana.tarefas,
            params,
            meses[0] as string,
            fimDoMes(meses.at(-1) as string),
          )}
        />
      )}
      {aba === "ronda" && (
        <AbaRonda
          p={p}
          linhas={sinalizacoes}
          codigos={codigos.filter((c) => c.area === "marketing")}
          antigaDias={params.sinalizacao_antiga_dias}
          limite={limite}
        />
      )}
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
      <CartaoCarregando altura="h-96" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CartaoCarregando altura="h-80" />
        <CartaoCarregando altura="h-80" />
      </div>
    </TelaCarregando>
  );
}
