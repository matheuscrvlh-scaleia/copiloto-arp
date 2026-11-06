import type { Metadata } from "next";
import { Suspense } from "react";
import { TiposDeItem } from "@/components/calendario/tipos";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { tipos } from "@/server/calendario/base";

export const metadata: Metadata = { title: "Tipos de item" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Tipos de item"
        description="O que pode ser marcado na agenda: nome, cor, ícone, os campos que o formulário pede e quem vê por padrão. Tipo desativado some do formulário, mas os itens dele continuam no calendário."
      />
      <Suspense
        fallback={
          <TelaCarregando>
            <CartaoCarregando altura="h-[28rem]" />
          </TelaCarregando>
        }
      >
        <Protegido permissao="calendario.configurar">
          <Lista />
        </Protegido>
      </Suspense>
    </>
  );
}

async function Lista() {
  return <TiposDeItem tipos={await tipos()} />;
}
