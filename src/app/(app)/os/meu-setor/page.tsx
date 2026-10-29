import type { Metadata } from "next";
import { Suspense } from "react";
import { EsqueletoVisao, PainelDaBusca } from "@/components/os/lista/topo";
import { CabecalhoOperacoes } from "@/components/os/operacoes";
import { SeuDia } from "@/components/os/seu-dia/seu-dia";
import { TelaGeral } from "@/components/os/telas/geral";
import { Protegido } from "@/components/protegido";
import { ROTAS_OS } from "@/lib/os/rotas";

export const metadata: Metadata = { title: "Geral" };

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <>
      <CabecalhoOperacoes descricao="Tudo o que é dos seus setores, para distribuir e cobrar: a fila sem responsável, os atrasados e a carga de cada pessoa. Atribua, mude prazo e prioridade direto na lista." />
      <Suspense fallback={<EsqueletoVisao />}>
        <Protegido permissao="os.meu_setor">
          <TelaGeral busca={searchParams} caminho={ROTAS_OS.meuSetor} />
          <Suspense fallback={null}>
            <SeuDia />
          </Suspense>
          <Suspense fallback={null}>
            <PainelDaBusca busca={searchParams} caminho={ROTAS_OS.meuSetor} />
          </Suspense>
        </Protegido>
      </Suspense>
    </>
  );
}
