import { formatarData } from "@arp/shared/formato";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { consultaParaLancarRonda } from "../api-residuos";
import { LancarRonda } from "../components/rondas/lancar";
import { useContextoSu } from "../contexto-su";

// /sustentabilidade/rondas/lancar (app/(app)/sustentabilidade/rondas/lancar/page.tsx).

export default function Page() {
  return (
    <>
      <PageHeader
        title="Lançar ronda"
        description="Passe pelos coletores e toque na ocupação de cada um. Ao salvar, o chamado da semana fecha e o coletor cheio abre o recolhimento."
      />
      <Suspense
        fallback={
          <TelaCarregando>
            <CartaoCarregando altura="h-96" />
          </TelaCarregando>
        }
      >
        <Protegido permissao="sustentabilidade.ronda">
          <Tela />
        </Protegido>
      </Suspense>
    </>
  );
}

function Tela() {
  const { data, dataUpdatedAt } = useSuspenseQuery(consultaParaLancarRonda);
  const ctx = useContextoSu(dataUpdatedAt);
  return (
    <LancarRonda
      coletores={data.coletores}
      limite={data.limite}
      dia={formatarData(ctx.hoje)}
      chamado={data.chamado}
    />
  );
}
