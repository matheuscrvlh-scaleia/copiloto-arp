import { mesesAFrente } from "@arp/shared/marketing/radar";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { AgendaDeEventos } from "@/modules/marketing/components/eventos";
import type { PropsAba } from "@/modules/marketing/components/radar/comum";
import { consultaDaAgenda } from "../api";
import { type FiltrosLidos, useFiltrosMkt } from "../base";

// /marketing/eventos: a agenda publicada no site, lida ao vivo.

export default function Page() {
  return (
    <>
      <PageHeader
        title="Eventos"
        description="A agenda publicada no site da ARP, lida ao vivo: o que vem nos próximos dias e meses, em cartões ou no calendário, e quantos eventos houve por mês."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="marketing.eventos">
          <Tela />
        </Protegido>
      </Suspense>
    </>
  );
}

function Tela() {
  const f = useFiltrosMkt("eventos", "mes");
  return f ? <Agenda f={f} /> : <Esqueleto />;
}

function Agenda({ f }: { f: FiltrosLidos }) {
  const { data: agenda } = useSuspenseQuery(consultaDaAgenda);
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
