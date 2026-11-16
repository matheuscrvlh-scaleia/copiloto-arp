import type { Metadata } from "next";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { LancarRonda } from "@/components/sustentabilidade/rondas/lancar";
import { formatarData } from "@/lib/formato";
import { numeroDo } from "@/lib/os/numeros";
import { chamadoAbertoDaOrigem } from "@/server/os/sistema";
import {
  coletores,
  contextoSu,
  parametros,
} from "@/server/sustentabilidade/base";

export const metadata: Metadata = { title: "Lançar ronda" };

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

async function Tela() {
  const [ctx, todos, param, chamado] = await Promise.all([
    contextoSu(),
    coletores(),
    parametros(),
    chamadoAbertoDaOrigem("sustentabilidade", "ronda"),
  ]);
  return (
    <LancarRonda
      coletores={todos
        .filter((c) => c.ativo)
        .map((c) => ({
          id: c.id,
          local: c.local,
          cor: c.cor as "preto" | "azul",
          conteineres: c.conteineres,
        }))}
      limite={param.limite_ocupacao_pct}
      dia={formatarData(ctx.hoje)}
      chamado={chamado ? numeroDo(chamado) : null}
    />
  );
}
