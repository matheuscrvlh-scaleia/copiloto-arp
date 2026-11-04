import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CartaoCarregando } from "@/components/carregando";
import { FormImovel } from "@/components/comercial/pesquisa/form-imovel";
import { Cartao } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { contextoCom, valoresDaLista } from "@/server/comercial/base";

export const metadata: Metadata = { title: "Cadastrar imóvel pesquisado" };

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

async function Novo() {
  const [ctx, bairros, tipos] = await Promise.all([
    contextoCom(),
    valoresDaLista("pesquisa_bairro"),
    valoresDaLista("pesquisa_tipo"),
  ]);
  return (
    <Cartao>
      <h2 className="mb-6 text-lg font-semibold">
        Cadastrar imóvel pesquisado
      </h2>
      <FormImovel
        bairros={bairros}
        tipos={tipos}
        inicial={{
          id: null,
          data_pesquisa: ctx.hoje,
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
