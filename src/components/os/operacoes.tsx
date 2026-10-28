import { Suspense } from "react";
import { Abas } from "@/components/os/abas";
import { PageHeader } from "@/components/page-header";
import { ROTAS_OS } from "@/lib/os/rotas";
import { contexto } from "@/server/os/base";

// Operações: o dia a dia do módulo numa tela só, com as abas Minha caixa,
// Meu setor e Abertos por mim (os endereços de cada uma não mudaram).

export function CabecalhoOperacoes({ descricao }: { descricao: string }) {
  return (
    <>
      <PageHeader title="Operações" description={descricao} />
      <div className="mb-6">
        <Suspense
          fallback={<div className="vidro h-11 w-96 max-w-full rounded-full" />}
        >
          <AbasDeOperacoes />
        </Suspense>
      </div>
    </>
  );
}

async function AbasDeOperacoes() {
  const ctx = await contexto();
  const abas = [
    { href: ROTAS_OS.caixa, rotulo: "Minha caixa" },
    ...(ctx.pode("os.meu_setor")
      ? [{ href: ROTAS_OS.meuSetor, rotulo: "Meu setor" }]
      : []),
    { href: ROTAS_OS.abertosPorMim, rotulo: "Abertos por mim" },
  ];
  return <Abas abas={abas} rotulo="Seções de Operações" />;
}
