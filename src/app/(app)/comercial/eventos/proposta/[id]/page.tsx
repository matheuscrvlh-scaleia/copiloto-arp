import { FileDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Situacao } from "@/components/admin/ui";
import { CartaoCarregando } from "@/components/carregando";
import { FormProposta } from "@/components/comercial/eventos/form-proposta";
import { FormAcao } from "@/components/form-acao";
import { Cartao } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import {
  STATUS_PROPOSTA,
  type StatusProposta,
  type TipoData,
} from "@/lib/comercial/eventos";
import { formatarDataHora } from "@/lib/formato";
import { mudarStatusProposta } from "@/server/comercial/acoes/eventos";
import {
  contextoCom,
  faixasEvento,
  parametros,
  valoresDaLista,
} from "@/server/comercial/base";
import {
  faixasParaCalculo,
  feriadosDosAnos,
  propostaEvento,
  regrasDe,
} from "@/server/comercial/eventos";

export const metadata: Metadata = { title: "Proposta de evento" };

const TOM = {
  rascunho: "neutro",
  enviada: "rodando",
  fechada: "ok",
  perdida: "erro",
} as const;

export default function Page({
  params,
}: PageProps<"/comercial/eventos/proposta/[id]">) {
  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/comercial/eventos"
        className="w-fit text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Eventos
      </Link>
      <Suspense fallback={<CartaoCarregando altura="h-[48rem]" />}>
        <Detalhe params={params} />
      </Suspense>
    </div>
  );
}

const texto = (v: string | null) => v ?? "";
const num = (v: number | null) => (v === null ? "" : String(Number(v)));

async function Detalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const ctx = await contextoCom();
  if (
    !ctx.pode("comercial.eventos.ver") &&
    !ctx.pode("comercial.eventos.editar")
  )
    return <SemAcesso />;
  const [p, faixas, param, lista] = await Promise.all([
    propostaEvento(id),
    faixasEvento(),
    parametros(),
    valoresDaLista("evento_observacao"),
  ]);
  if (!p) notFound();
  const ano = Number((p.data_evento ?? ctx.hoje).slice(0, 4));
  const { feriados } = await feriadosDosAnos([ano - 1, ano, ano + 1]);
  const podeEditar = ctx.pode("comercial.eventos.editar");
  const status = p.status as StatusProposta;
  // A lista padrão e as que já estavam marcadas (mesmo que tenham saído dela).
  const observacoes = [
    ...lista,
    ...p.observacoes.filter((o) => !lista.includes(o)),
  ];

  return (
    <Cartao>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Proposta · {p.cliente}</h2>
          <p className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <Situacao tipo={TOM[status] ?? "neutro"}>
              {STATUS_PROPOSTA[status] ?? p.status}
            </Situacao>
            Criada em {formatarDataHora(p.criado_em)} · alterada em{" "}
            {formatarDataHora(p.atualizado_em)}
            {p.exemplo && " · proposta de exemplo"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/comercial/eventos/proposta/${p.id}/pdf`}
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400"
          >
            <FileDown className="size-4" aria-hidden />
            Gerar PDF
          </a>
          {podeEditar &&
            (Object.keys(STATUS_PROPOSTA) as StatusProposta[])
              .filter((s) => s !== status)
              .map((s) => (
                <FormAcao
                  key={s}
                  acao={mudarStatusProposta}
                  rotulo={
                    s === "rascunho"
                      ? "Voltar a rascunho"
                      : `Marcar como ${STATUS_PROPOSTA[s].toLowerCase()}`
                  }
                  rotuloEnviando="Salvando…"
                  variante="secundario"
                >
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="status" value={s} />
                </FormAcao>
              ))}
        </div>
      </div>
      <FormProposta
        somenteLeitura={!podeEditar}
        inicial={{
          id: p.id,
          cliente: p.cliente,
          oportunidade_rd: texto(p.oportunidade_rd),
          data_evento: texto(p.data_evento),
          data_evento_fim: texto(p.data_evento_fim),
          horario: texto(p.horario),
          tipo_data: p.tipo_data as TipoData,
          area_m2: num(p.area_m2),
          dias: String(p.dias),
          pessoas: num(p.pessoas),
          desconto_pct: num(p.desconto_pct),
          desconto_primeira_edicao: num(p.desconto_primeira_edicao),
          validade: texto(p.validade),
          condicao_pagamento: texto(p.condicao_pagamento),
          montagem: texto(p.montagem),
          desmontagem: texto(p.desmontagem),
          area_evento: texto(p.area_evento),
          observacoes: p.observacoes,
        }}
        faixas={faixasParaCalculo(faixas)}
        regras={regrasDe(param)}
        observacoes={observacoes}
        notas={p.notas.length ? p.notas : param.evento_notas}
        feriados={feriados}
        fechamentoDiasUteis={param.evento_fechamento_dias_uteis}
      />
    </Cartao>
  );
}
