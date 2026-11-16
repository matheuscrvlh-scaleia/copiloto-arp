import { ROTAS_OS } from "@arp/shared/os/rotas";
import { Suspense } from "react";
import { Abas } from "@/components/abas";
import { PageHeader } from "@/components/page-header";
import { usePermissao } from "@/lib/sessao";

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

/**
 * Ordens de serviço: as mesmas abas do dia a dia (Minha caixa, Meu setor,
 * Quadro), lendo as OS, e o Acompanhamento: todas as OS, com prazo, tempo,
 * custo e relatórios.
 */
export function CabecalhoOrdens({ descricao }: { descricao: string }) {
  return (
    <>
      <PageHeader title="Ordens de serviço" description={descricao} />
      <div className="mb-6">
        <Suspense
          fallback={<div className="vidro h-11 w-96 max-w-full rounded-full" />}
        >
          <AbasDasOrdens />
        </Suspense>
      </div>
    </>
  );
}

function AbasDasOrdens() {
  const meuSetor = usePermissao("os.meu_setor");
  const abas = [
    { href: ROTAS_OS.ordensCaixa, rotulo: "Minha caixa" },
    ...(meuSetor
      ? [{ href: ROTAS_OS.ordensMeuSetor, rotulo: "Meu setor" }]
      : []),
    { href: ROTAS_OS.ordensQuadro, rotulo: "Quadro" },
    { href: ROTAS_OS.ordens, rotulo: "Acompanhamento" },
  ];
  return <Abas abas={abas} rotulo="Seções de Ordens de serviço" />;
}

function AbasDeOperacoes() {
  const meuSetor = usePermissao("os.meu_setor");
  const modelos = usePermissao("os.modelos");
  const abas = [
    { href: ROTAS_OS.caixa, rotulo: "Minha caixa" },
    ...(meuSetor ? [{ href: ROTAS_OS.meuSetor, rotulo: "Geral" }] : []),
    { href: ROTAS_OS.quadro, rotulo: "Quadro" },
    { href: ROTAS_OS.avisos, rotulo: "Avisos" },
    ...(modelos
      ? [{ href: ROTAS_OS.disparos, rotulo: "Disparos e lembretes" }]
      : []),
  ];
  return <Abas abas={abas} rotulo="Seções de Operações" />;
}
