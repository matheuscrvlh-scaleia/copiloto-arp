import type { Metadata } from "next";
import { Suspense } from "react";
import { CartaoCarregando } from "@/components/carregando";
import { PageHeader } from "@/components/page-header";
import { type Busca, ConteudoDoNovo } from "./conteudo";

export const metadata: Metadata = { title: "Novo chamado" };

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  return (
    <>
      <PageHeader
        title="Novo chamado"
        description="Escolha a categoria, escreva o título e envie. O resto é opcional."
      />
      <Suspense fallback={<CartaoCarregando altura="h-[32rem]" />}>
        <ConteudoDoNovo searchParams={searchParams} ehOS={false} />
      </Suspense>
    </>
  );
}
