import { faixaDeTamanho } from "@arp/shared/comercial/pesquisa";
import { formatarDataHora } from "@arp/shared/formato";
import { useSuspenseQueries } from "@tanstack/react-query";
import { Suspense } from "react";
import { z } from "zod";
import { CartaoCarregando } from "@/components/carregando";
import { Cartao } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { Link, naoEncontrado, useParametro } from "@/lib/navegacao";
import { usePermissao } from "@/lib/sessao";
import { FormImovel } from "@/modules/comercial/components/pesquisa/form-imovel";
import { Valor } from "@/modules/comercial/components/tela";
import { consultaApoioPesquisa, consultaImovel } from "../../api/pesquisa";

// /comercial/pesquisa/:id (app/(app)/comercial/pesquisa/[id]/page.tsx).

export default function Page() {
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
          <Detalhe />
        </Protegido>
      </Suspense>
    </div>
  );
}

const texto = (v: number | string | null) => (v === null ? "" : String(v));

function Detalhe() {
  const id = useParametro("id");
  if (!z.uuid().safeParse(id).success) naoEncontrado();
  return <Imovel id={id} />;
}

function Imovel({ id }: { id: string }) {
  const [
    {
      data: { imovel: i },
    },
    { data: apoio },
  ] = useSuspenseQueries({
    queries: [consultaImovel(id), consultaApoioPesquisa],
  });
  const { bairros, tipos } = apoio;
  const p = { pesquisa_faixas_m2: apoio.faixasM2 };
  const podeEditar = usePermissao("comercial.pesquisa.editar");
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
