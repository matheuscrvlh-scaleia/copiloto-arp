import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { CartaoCarregando } from "@/components/carregando";
import { Cartao } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { Link } from "@/lib/navegacao";
import { FormImovel } from "@/modules/comercial/components/pesquisa/form-imovel";
import { consultaApoioPesquisa } from "../../api/pesquisa";

// /comercial/pesquisa/novo (app/(app)/comercial/pesquisa/novo/page.tsx).

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
        <Protegido permissao="comercial.pesquisa.editar">
          <Novo />
        </Protegido>
      </Suspense>
    </div>
  );
}

function Novo() {
  const { data: d } = useSuspenseQuery(consultaApoioPesquisa);
  return (
    <Cartao>
      <h2 className="mb-6 text-lg font-semibold">
        Cadastrar imóvel pesquisado
      </h2>
      <FormImovel
        bairros={d.bairros}
        tipos={d.tipos}
        inicial={{
          id: null,
          data_pesquisa: d.hoje,
          cep: "",
          endereco: "",
          bairro: "",
          tipo: "",
          area_m2: "",
          aluguel: "",
          condominio: "",
          iptu: "",
          vagas: "",
          observacao: "",
          fonte: "",
        }}
      />
    </Cartao>
  );
}
