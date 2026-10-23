import { Suspense } from "react";
import { BotaoNovoChamado } from "@/components/os/novo/botao-novo";

// Tickets: o botão "+ Novo" fica visível em todas as telas do módulo
// (abrir um chamado leva no máximo três passos).
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <BotaoNovoChamado />
      </Suspense>
    </>
  );
}
