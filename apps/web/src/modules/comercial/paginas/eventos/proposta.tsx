import {
  STATUS_PROPOSTA,
  type StatusProposta,
  type TipoData,
} from "@arp/shared/comercial/eventos";
import { formatarDataHora } from "@arp/shared/formato";
import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";
import { FileDown } from "lucide-react";
import { Suspense } from "react";
import { z } from "zod";
import { CartaoCarregando } from "@/components/carregando";
import { FormAcao } from "@/components/form-acao";
import { Cartao } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { Link, naoEncontrado, useParametro } from "@/lib/navegacao";
import { useSessao } from "@/lib/sessao";
import { Situacao } from "@/modules/admin/components/ui";
import { FormProposta } from "@/modules/comercial/components/eventos/form-proposta";
import {
  consultaApoioEventos,
  consultaFeriadosEventos,
  consultaProposta,
  linkDoPdfDaProposta,
  mudarStatusProposta,
} from "../../api/eventos";

// /comercial/eventos/proposta/:id
// (app/(app)/comercial/eventos/proposta/[id]/page.tsx).

const TOM = {
  rascunho: "neutro",
  enviada: "rodando",
  fechada: "ok",
  perdida: "erro",
} as const;

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
        <Detalhe />
      </Suspense>
    </div>
  );
}

const texto = (v: string | null) => v ?? "";
const num = (v: number | null) => (v === null ? "" : String(Number(v)));

function Detalhe() {
  const id = useParametro("id");
  const { pode } = useSessao();
  if (!z.uuid().safeParse(id).success) naoEncontrado();
  if (!pode("comercial.eventos.ver") && !pode("comercial.eventos.editar"))
    return <SemAcesso />;
  return <Proposta id={id} />;
}

function Proposta({ id }: { id: string }) {
  const { pode } = useSessao();
  const [
    {
      data: { proposta: p },
    },
    { data: param },
  ] = useSuspenseQueries({
    queries: [consultaProposta(id), consultaApoioEventos],
  });
  const lista = param.observacoes;
  const ano = Number((p.data_evento ?? param.hoje).slice(0, 4));
  const {
    data: { feriados },
  } = useSuspenseQuery(consultaFeriadosEventos([ano - 1, ano, ano + 1]));
  const podeEditar = pode("comercial.eventos.editar");
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
            href={linkDoPdfDaProposta(p.id)}
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
        faixas={param.faixas}
        regras={param.regras}
        observacoes={observacoes}
        notas={p.notas.length ? p.notas : param.notas}
        feriados={feriados}
        fechamentoDiasUteis={param.fechamentoDiasUteis}
      />
    </Cartao>
  );
}
