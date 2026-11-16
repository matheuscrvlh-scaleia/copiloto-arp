import { somarDias } from "@arp/shared/comercial/datas";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { CartaoCarregando } from "@/components/carregando";
import { Cartao } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { Link, useBusca } from "@/lib/navegacao";
import { FormProposta } from "@/modules/comercial/components/eventos/form-proposta";
import {
  consultaApoioEventos,
  consultaFeriadosEventos,
} from "../../api/eventos";

// /comercial/eventos/proposta/nova
// (app/(app)/comercial/eventos/proposta/nova/page.tsx): o simulador manda
// tipo, área, dias, pessoas e desconto pela URL.

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/comercial/eventos"
        className="w-fit text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Eventos
      </Link>
      <Suspense fallback={<CartaoCarregando altura="h-[48rem]" />}>
        <Protegido permissao="comercial.eventos.editar">
          <Nova />
        </Protegido>
      </Suspense>
    </div>
  );
}

const um = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";
const numero = (v: string, padrao: string) =>
  Number.isFinite(Number(v)) && Number(v) > 0 ? v : padrao;

function Nova() {
  const b = useBusca();
  const { data: p } = useSuspenseQuery(consultaApoioEventos);
  const ano = Number(p.hoje.slice(0, 4));
  const {
    data: { feriados },
  } = useSuspenseQuery(consultaFeriadosEventos([ano, ano + 1, ano + 2]));
  const desconto = um(b.desconto);
  return (
    <Cartao>
      <h2 className="mb-6 text-lg font-semibold">Nova proposta de evento</h2>
      <FormProposta
        inicial={{
          id: null,
          cliente: "",
          oportunidade_rd: "",
          data_evento: "",
          data_evento_fim: "",
          horario: p.horario,
          tipo_data: um(b.tipo) === "sazonal" ? "sazonal" : "comum",
          area_m2: numero(um(b.area), ""),
          dias: numero(um(b.dias), "1"),
          pessoas: numero(um(b.pessoas), ""),
          desconto_pct:
            desconto !== "" && Number(desconto) >= 0 && Number(desconto) <= 100
              ? desconto
              : String(p.descontoPct),
          desconto_primeira_edicao: "0",
          validade: somarDias(p.hoje, p.validadeDias),
          condicao_pagamento: p.condicaoPagamento,
          montagem: p.montagem,
          desmontagem: p.desmontagem,
          area_evento: p.areaTexto,
          observacoes: p.observacoes,
        }}
        faixas={p.faixas}
        regras={p.regras}
        observacoes={p.observacoes}
        notas={p.notas}
        feriados={feriados}
        fechamentoDiasUteis={p.fechamentoDiasUteis}
      />
    </Cartao>
  );
}
