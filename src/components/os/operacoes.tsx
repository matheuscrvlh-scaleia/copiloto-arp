import { Suspense } from "react";
import { Abas } from "@/components/os/abas";
import { PageHeader } from "@/components/page-header";
import { ROTAS_OS } from "@/lib/os/rotas";
import { contexto } from "@/server/os/base";

// Operações: o dia a dia do módulo numa tela só, com as abas Minha caixa,
// Geral, Quadro, Avisos e Disparos e lembretes. "Abertos por mim" é filtro
// das listas; os avisos só aparecem na aba deles.

export function CabecalhoOperacoes({ descricao }: { descricao: string }) {
  return (
    <>
      <PageHeader title="Chamados" description={descricao} />
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
      ? [{ href: ROTAS_OS.meuSetor, rotulo: "Geral" }]
      : []),
    { href: ROTAS_OS.quadro, rotulo: "Quadro" },
    { href: ROTAS_OS.avisos, rotulo: "Avisos" },
    ...(ctx.pode("os.modelos")
      ? [{ href: ROTAS_OS.disparos, rotulo: "Disparos e lembretes" }]
      : []),
  ];
  return <Abas abas={abas} rotulo="Seções de Operações" />;
}
