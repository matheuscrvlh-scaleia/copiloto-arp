import { Suspense } from "react";
import { Filhas } from "@/lib/navegacao";
import { BotaoNovoChamado } from "@/modules/os/components/novo/botao-novo";

// Tickets: o botão "+ Novo" fica visível em todas as telas do módulo
// (abrir um chamado leva no máximo três passos).
export default function Layout() {
  return (
    <>
      <Filhas />
      <Suspense fallback={null}>
        <BotaoNovoChamado />
      </Suspense>
    </>
  );
}
