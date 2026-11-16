import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { Protegido } from "@/components/protegido";
import { consultaDoHistorico } from "../../api";
import { BlocoHistorico } from "../../components/configuracoes/historico";
import {
  EsqueletoConfiguracoes,
  TopoConfiguracoes,
} from "../../components/configuracoes/topo";

// app/(app)/marketing/configuracoes/historico/page.tsx

export default function Page() {
  return (
    <Suspense fallback={<EsqueletoConfiguracoes />}>
      <Protegido permissao="marketing.parametros">
        <Tela />
      </Protegido>
    </Suspense>
  );
}

function Tela() {
  const { data: historico } = useSuspenseQuery(consultaDoHistorico());
  return (
    <div className="flex flex-col gap-6">
      <TopoConfiguracoes ultima={historico[0]} />
      <BlocoHistorico linhas={historico} />
    </div>
  );
}
