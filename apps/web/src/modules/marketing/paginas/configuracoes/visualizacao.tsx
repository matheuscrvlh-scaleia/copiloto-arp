import { useSuspenseQueries } from "@tanstack/react-query";
import { Suspense } from "react";
import { Protegido } from "@/components/protegido";
import { consultaDoHistorico, consultaDosParametros } from "../../api";
import { BlocoVisualizacao } from "../../components/configuracoes/blocos";
import {
  EsqueletoConfiguracoes,
  TopoConfiguracoes,
} from "../../components/configuracoes/topo";

// app/(app)/marketing/configuracoes/visualizacao/page.tsx
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

function Tela() {
  const [{ data: p }, { data: historico }] = useSuspenseQueries({
    queries: [consultaDosParametros, consultaDoHistorico(1)],
  });
  return (
    <div className="flex flex-col gap-6">
      <TopoConfiguracoes ultima={historico[0]} />
      <BlocoVisualizacao ocultos={p.quadros_ocultos} />
    </div>
  );
}
