import type { Metadata } from "next";
import { Suspense } from "react";
import { EsqueletoVisao, PainelDaBusca } from "@/components/os/lista/topo";
import { CabecalhoOrdens } from "@/components/os/operacoes";
import { TelaCaixa } from "@/components/os/telas/caixa";
import { Protegido } from "@/components/protegido";
import { ROTAS_OS } from "@/lib/os/rotas";

export const metadata: Metadata = { title: "Minha caixa das OS" };

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <>
      <CabecalhoOrdens descricao="As OS que estão com você para fazer: as suas, os destinos seus e do seu setor e a fila do setor, pelo prazo. Em cima, o que espera a sua confirmação. Em Mostrar, veja as OS que você abriu." />
      <Suspense fallback={<EsqueletoVisao />}>
        <Protegido permissao="os.acessar">
          <TelaCaixa busca={searchParams} ordens />
          <Suspense fallback={null}>
            <PainelDaBusca
              busca={searchParams}
              caminho={ROTAS_OS.ordensCaixa}
            />
          </Suspense>
        </Protegido>
      </Suspense>
    </>
  );
}
