"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormularioChamado } from "@/components/os/novo/formulario";
import { Sucesso } from "@/components/os/novo/novo-chamado";
import type {
  DadosDoFormulario,
  InicialDoFormulario,
} from "@/components/os/novo/tipos";
import { rotaChamado } from "@/lib/os/rotas";

/**
 * Formulário na página /os/novo: abriu sem aviso, vai direto para o
 * chamado; com aviso (ex.: horário não reservado), mostra antes.
 */
export function NovoNaPagina({
  dados,
  inicial,
}: {
  dados: DadosDoFormulario;
  inicial: InicialDoFormulario;
}) {
  const router = useRouter();
  const [criado, setCriado] = useState<{
    id: string;
    numero: number;
    aviso?: string;
  } | null>(null);
  const [rodada, setRodada] = useState(0);

  if (criado)
    return (
      <Sucesso
        criado={criado}
        aoAbrirOutro={() => {
          setCriado(null);
          setRodada((r) => r + 1);
        }}
      />
    );
  return (
    <FormularioChamado
      key={rodada}
      dados={dados}
      inicial={inicial}
      aoCriar={(r) => {
        if (r.aviso) setCriado(r);
        else router.push(rotaChamado(r.id));
      }}
    />
  );
}
