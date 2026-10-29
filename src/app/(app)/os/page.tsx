import type { Metadata } from "next";
import { Suspense } from "react";
import { EsqueletoVisao, PainelDaBusca } from "@/components/os/lista/topo";
import { CabecalhoOperacoes } from "@/components/os/operacoes";
import { SeuDia } from "@/components/os/seu-dia/seu-dia";
import { TelaCaixa } from "@/components/os/telas/caixa";
import { Protegido } from "@/components/protegido";

export const metadata: Metadata = { title: "Minha caixa" };

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <>
      <CabecalhoOperacoes descricao="O que está com você para fazer: os seus chamados, os destinos seus e do seu setor e a fila do setor, pelo prazo. Em cima, o que espera a sua confirmação. Em Mostrar, veja o que você abriu para outros setores e pessoas." />
      <Suspense fallback={<EsqueletoVisao />}>
        <Protegido permissao="os.acessar">
          <TelaCaixa busca={searchParams} />
          <Suspense fallback={null}>
            <SeuDia />
          </Suspense>
          <Suspense fallback={null}>
            <PainelDaBusca busca={searchParams} caminho="/os" />
          </Suspense>
        </Protegido>
      </Suspense>
    </>
  );
}
