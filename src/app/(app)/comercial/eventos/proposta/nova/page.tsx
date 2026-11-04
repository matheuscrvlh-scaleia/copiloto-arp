import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CartaoCarregando } from "@/components/carregando";
import { FormProposta } from "@/components/comercial/eventos/form-proposta";
import { Cartao } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { somarDias } from "@/lib/comercial/datas";
import {
  contextoCom,
  faixasEvento,
  parametros,
  valoresDaLista,
} from "@/server/comercial/base";
import {
  faixasParaCalculo,
  feriadosDosAnos,
  regrasDe,
} from "@/server/comercial/eventos";
import type { Busca } from "@/server/comercial/filtros";

export const metadata: Metadata = { title: "Nova proposta de evento" };

export default function Page({
  searchParams,
}: PageProps<"/comercial/eventos/proposta/nova">) {
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
          <Nova busca={searchParams} />
        </Protegido>
      </Suspense>
    </div>
  );
}

const um = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";
const numero = (v: string, padrao: string) =>
  Number.isFinite(Number(v)) && Number(v) > 0 ? v : padrao;

async function Nova({ busca }: { busca: Promise<Busca> }) {
  const [b, ctx, faixas, p, observacoes] = await Promise.all([
    busca,
    contextoCom(),
    faixasEvento(),
    parametros(),
    valoresDaLista("evento_observacao"),
  ]);
  const ano = Number(ctx.hoje.slice(0, 4));
  const { feriados } = await feriadosDosAnos([ano, ano + 1, ano + 2]);
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
          horario: p.evento_horario,
          tipo_data: um(b.tipo) === "sazonal" ? "sazonal" : "comum",
          area_m2: numero(um(b.area), ""),
          dias: numero(um(b.dias), "1"),
          pessoas: numero(um(b.pessoas), ""),
          desconto_pct:
            desconto !== "" && Number(desconto) >= 0 && Number(desconto) <= 100
              ? desconto
              : String(Number(p.evento_desconto_pct)),
          desconto_primeira_edicao: "0",
          validade: somarDias(ctx.hoje, p.evento_validade_dias),
          condicao_pagamento: p.evento_condicao_pagamento,
          montagem: p.evento_montagem,
          desmontagem: p.evento_desmontagem,
          area_evento: p.evento_area_texto,
          observacoes,
        }}
        faixas={faixasParaCalculo(faixas)}
        regras={regrasDe(p)}
        observacoes={observacoes}
        notas={p.evento_notas}
        feriados={feriados}
        fechamentoDiasUteis={p.evento_fechamento_dias_uteis}
      />
    </Cartao>
  );
}
