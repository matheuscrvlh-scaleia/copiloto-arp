import type { Metadata } from "next";
import { Suspense } from "react";
import { Protegido } from "@/components/protegido";
import { historicoMkt, LIMITE_HISTORICO } from "@/server/marketing/parametros";
import { BlocoHistorico } from "../historico";
import { EsqueletoConfiguracoes, TopoConfiguracoes } from "../topo";

export const metadata: Metadata = { title: "Histórico do Marketing" };

export default function Page() {
  return (
    <Suspense fallback={<EsqueletoConfiguracoes />}>
      <Protegido permissao="marketing.parametros">
        <Tela />
      </Protegido>
    </Suspense>
  );
}

async function Tela() {
  const historico = await historicoMkt(LIMITE_HISTORICO);
  return (
    <div className="flex flex-col gap-6">
      <TopoConfiguracoes ultima={historico[0]} />
      <BlocoHistorico linhas={historico} />
    </div>
  );
}
