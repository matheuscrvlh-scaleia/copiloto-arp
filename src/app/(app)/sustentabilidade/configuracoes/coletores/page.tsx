import type { Metadata } from "next";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Protegido } from "@/components/protegido";
import { CadastroDeColetores } from "@/components/sustentabilidade/coletores/cadastro";
import { coletores } from "@/server/sustentabilidade/base";

export const metadata: Metadata = { title: "Coletores" };

export default function Page() {
  return (
    <>
      <p className="mb-6 max-w-3xl text-sm text-neutral-600">
        Os coletores que a ronda semanal percorre: local, cor, quantidade de
        contêineres e capacidade. O limite de alerta e quem recebe o chamado de
        recolhimento ficam em Parâmetros.
      </p>
      <Suspense
        fallback={
          <TelaCarregando>
            <CartaoCarregando altura="h-96" />
          </TelaCarregando>
        }
      >
        <Protegido permissao="sustentabilidade.parametros">
          <Lista />
        </Protegido>
      </Suspense>
    </>
  );
}

async function Lista() {
  const todos = await coletores();
  return (
    <CadastroDeColetores
      podeEditar
      coletores={todos.map((c) => ({
        id: c.id,
        local: c.local,
        cor: c.cor as "preto" | "azul",
        conteineres: c.conteineres,
        capacidadeL: c.capacidade_l,
        ativo: c.ativo,
        ordem: c.ordem,
        exemplo: c.exemplo,
      }))}
    />
  );
}
