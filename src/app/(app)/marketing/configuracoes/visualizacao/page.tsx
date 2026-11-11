import type { Metadata } from "next";
import { Suspense } from "react";
import { Protegido } from "@/components/protegido";
import { parametros } from "@/server/marketing/base";
import { historicoMkt } from "@/server/marketing/parametros";
import { BlocoVisualizacao } from "../blocos";
import { EsqueletoConfiguracoes, TopoConfiguracoes } from "../topo";

export const metadata: Metadata = { title: "Visualização do Marketing" };

// Visualização padrão: quais quadros aparecem em cada tela, igual para todos
// do módulo. A alteração cai no Histórico, com a opção de voltar.

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
  const [p, historico] = await Promise.all([parametros(), historicoMkt(1)]);
  return (
    <div className="flex flex-col gap-6">
      <TopoConfiguracoes ultima={historico[0]} />
      <BlocoVisualizacao ocultos={p.quadros_ocultos} />
    </div>
  );
}
