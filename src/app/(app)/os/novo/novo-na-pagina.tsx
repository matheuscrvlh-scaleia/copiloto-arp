"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormularioChamado } from "@/components/os/novo/formulario";
import { Sucesso } from "@/components/os/novo/novo-chamado";
import type {
  DadosDoFormulario,
  InicialDoFormulario,
} from "@/components/os/novo/tipos";
import { rotaDo } from "@/lib/os/rotas";

/**
 * Formulário nas páginas /os/novo e /os/ordens/nova: abriu sem aviso, vai
 * direto para o chamado (ou a OS); com aviso (ex.: horário não
 * reservado), mostra antes.
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
  const ehOS = inicial.tipo === "os";

  if (criado)
    return (
      <Sucesso
        criado={criado}
        ehOS={ehOS}
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
        // Sai do formulário já: a navegação leva segundos e, com ele cheio
        // e o botão ativo, um segundo clique abria outro chamado igual (o
        // Voltar do navegador também o trazia preenchido).
        setCriado(r);
        if (!r.aviso)
          router.push(rotaDo({ id: r.id, tipo: ehOS ? "os" : "solicitacao" }));
      }}
    />
  );
}
