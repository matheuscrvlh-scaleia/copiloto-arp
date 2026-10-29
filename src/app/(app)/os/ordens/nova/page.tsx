import type { Metadata } from "next";
import { Suspense } from "react";
import { CartaoCarregando } from "@/components/carregando";
import { PageHeader } from "@/components/page-header";
import { type Busca, ConteudoDoNovo } from "../../novo/conteudo";

export const metadata: Metadata = { title: "Nova Ordem de Serviço" };

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  return (
    <>
      <PageHeader
        title="Nova Ordem de Serviço"
        description="Escolha a categoria, escreva o título e envie. Tempo, materiais e terceirizado entram depois, no detalhe da OS."
      />
      <Suspense fallback={<CartaoCarregando altura="h-[32rem]" />}>
        <ConteudoDoNovo searchParams={searchParams} ehOS />
      </Suspense>
    </>
  );
}
