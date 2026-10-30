import type { Metadata } from "next";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { AgendaDeEventos } from "@/components/marketing/eventos";
import type { PropsAba } from "@/components/marketing/radar/comum";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { mesesAFrente } from "@/lib/marketing/radar";
import { agendaDoSite } from "@/server/marketing/eventos";
import { type Busca, lerFiltros } from "@/server/marketing/filtros";

export const metadata: Metadata = { title: "Eventos" };

export default function Page({
  searchParams,
}: PageProps<"/marketing/eventos">) {
  return (
    <>
      <PageHeader
        title="Eventos"
        description="A agenda publicada no site da ARP, lida ao vivo: o que vem nos próximos dias e meses, em cartões ou no calendário, e quantos eventos houve por mês."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="marketing.eventos">
          <Tela busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

async function Tela({ busca }: { busca: Promise<Busca> }) {
  const [f, agenda] = await Promise.all([
    busca.then((b) => lerFiltros("eventos", b, "mes")),
    agendaDoSite(),
  ]);
  const p: PropsAba = {
    busca: f.busca,
    lembrado: f.lembrado,
    hoje: f.ctx.hoje,
    dadosDe: f.ctx.dadosDe,
    exportar: f.ctx.pode("marketing.exportar"),
    um: f.um,
  };
  return (
    <div className="flex flex-col gap-6">
      <AgendaDeEventos
        p={p}
        agenda={agenda}
        meses={mesesAFrente(f.ctx.hoje, 6)}
      />
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
      <CartaoCarregando altura="h-80" />
    </TelaCarregando>
  );
}
