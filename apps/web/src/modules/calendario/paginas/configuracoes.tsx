import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { consultaDosTipos } from "../api";
import { TiposDeItem } from "../components/tipos";

// /calendario/configuracoes: Calendário › Tipos de item.

export default function Pagina() {
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

function Lista() {
  const { data: tipos } = useSuspenseQuery(consultaDosTipos);
  return <TiposDeItem tipos={tipos} />;
}
