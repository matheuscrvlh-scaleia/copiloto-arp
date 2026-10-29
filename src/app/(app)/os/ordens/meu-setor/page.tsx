import type { Metadata } from "next";
import { Suspense } from "react";
import { EsqueletoVisao, PainelDaBusca } from "@/components/os/lista/topo";
import { CabecalhoOrdens } from "@/components/os/operacoes";
import { TelaGeral } from "@/components/os/telas/geral";
import { Protegido } from "@/components/protegido";
import { ROTAS_OS } from "@/lib/os/rotas";

export const metadata: Metadata = { title: "Meu setor (OS)" };

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <>
      <CabecalhoOrdens descricao="As OS dos seus setores, para distribuir e cobrar: a fila sem responsável, as atrasadas e a carga de cada pessoa. Atribua, mude prazo e prioridade direto na lista." />
      <Suspense fallback={<EsqueletoVisao />}>
        <Protegido permissao="os.meu_setor">
          <TelaGeral
            busca={searchParams}
            caminho={ROTAS_OS.ordensMeuSetor}
            ordens
          />
          <Suspense fallback={null}>
            <PainelDaBusca
              busca={searchParams}
              caminho={ROTAS_OS.ordensMeuSetor}
            />
          </Suspense>
        </Protegido>
      </Suspense>
    </>
  );
}
