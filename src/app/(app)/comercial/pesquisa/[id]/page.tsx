import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { CartaoCarregando } from "@/components/carregando";
import { FormImovel } from "@/components/comercial/pesquisa/form-imovel";
import { Valor } from "@/components/comercial/tela";
import { Cartao } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { faixaDeTamanho } from "@/lib/comercial/pesquisa";
import { formatarDataHora } from "@/lib/formato";
import {
  contextoCom,
  parametros,
  valoresDaLista,
} from "@/server/comercial/base";
import { imovelPesquisado } from "@/server/comercial/pesquisa";

export const metadata: Metadata = { title: "Imóvel pesquisado" };

export default function Page({
  params,
}: PageProps<"/comercial/pesquisa/[id]">) {
  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/comercial/pesquisa"
        className="w-fit text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Pesquisa de mercado
      </Link>
      <Suspense fallback={<CartaoCarregando altura="h-[40rem]" />}>
        <Protegido permissao="comercial.pesquisa.ver">
          <Detalhe params={params} />
        </Protegido>
      </Suspense>
    </div>
  );
}

const texto = (v: number | string | null) => (v === null ? "" : String(v));

async function Detalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [ctx, i, bairros, tipos, p] = await Promise.all([
    contextoCom(),
    imovelPesquisado(id),
    valoresDaLista("pesquisa_bairro"),
    valoresDaLista("pesquisa_tipo"),
    parametros(),
  ]);
  if (!i) notFound();
  const podeEditar = ctx.pode("comercial.pesquisa.editar");
  return (
    <Cartao>
      <div className="mb-6 flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{i.endereco}</h2>
        <p className="text-xs text-neutral-500">
          {i.bairro} · {i.tipo} ·{" "}
          {faixaDeTamanho(i.area_m2, p.pesquisa_faixas_m2.map(Number))}
          {i.importado ? " · veio da importação da planilha" : ""}
          {i.exemplo ? " · imóvel de exemplo" : ""} · cadastrado em{" "}
          {formatarDataHora(i.criado_em)}
        </p>
        <dl className="mt-3 grid grid-cols-3 gap-4 text-sm sm:max-w-lg">
          <div>
            <dt className="text-xs text-neutral-500">Valor por m²</dt>
            <dd className="font-semibold">
              <Valor valor={i.valor_m2} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Custo total</dt>
            <dd className="font-semibold">
              <Valor valor={i.custo_total} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Custo por m²</dt>
            <dd className="font-semibold">
              <Valor valor={i.custo_m2} />
            </dd>
          </div>
        </dl>
      </div>
      <FormImovel
        somenteLeitura={!podeEditar}
        bairros={bairros}
        tipos={tipos}
        inicial={{
          id: i.id,
          data_pesquisa: i.data_pesquisa,
          cep: i.cep ?? "",
          endereco: i.endereco,
          bairro: i.bairro,
          tipo: i.tipo,
          area_m2: texto(i.area_m2),
          aluguel: texto(i.aluguel),
          condominio: texto(i.condominio),
          iptu: texto(i.iptu),
          vagas: texto(i.vagas),
          observacao: i.observacao ?? "",
          fonte: i.fonte ?? "",
        }}
      />
    </Cartao>
  );
}
