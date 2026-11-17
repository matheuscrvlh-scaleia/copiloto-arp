import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Protegido } from "@/components/protegido";
import { consultaDosColetores } from "../../api";
import { CadastroDeColetores } from "../../components/coletores/cadastro";

export default function Coletores() {
  return (
    <>
      <p className="mb-6 max-w-3xl text-sm text-neutral-600">
        Os coletores que a ronda semanal percorre: local, cor, quantidade de
        contêineres e capacidade. O limite de alerta e quem recebe o chamado de
        recolhimento ficam em Parâmetros.
      </p>
      <Protegido permissao="sustentabilidade.parametros">
        <Suspense
          fallback={
            <TelaCarregando>
              <CartaoCarregando altura="h-96" />
            </TelaCarregando>
          }
        >
          <Lista />
        </Suspense>
      </Protegido>
    </>
  );
}

function Lista() {
  const { data: todos } = useSuspenseQuery(consultaDosColetores);
  return (
    <CadastroDeColetores
      podeEditar
      coletores={todos.map((c) => ({
        id: c.id,
        local: c.local,
        cor: c.cor === "azul" ? "azul" : "preto",
        conteineres: c.conteineres,
        capacidadeL: c.capacidade_l,
        ativo: c.ativo,
        ordem: c.ordem,
        exemplo: c.exemplo,
      }))}
    />
  );
}
