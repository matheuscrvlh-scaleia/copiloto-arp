import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { slugDoSetor } from "@/lib/os/indicadores-setor";
import { ROTAS_OS } from "@/lib/os/rotas";
import { contexto } from "@/server/os/base";
import { setoresDoPainel } from "@/server/os/paineis/acesso";
import type { Busca } from "@/server/os/paineis/consultas";
import { EsqueletoDoPainel, Painel } from "./_painel/tela";

export const metadata: Metadata = { title: "Painéis" };

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  return (
    <>
      <PageHeader
        title="Painéis"
        description="Tickets em números: em aberto, atrasados, fechados no prazo e o que importa para cada setor. Todo número abre a lista que o forma."
      />
      <Suspense fallback={<EsqueletoDoPainel />}>
        <Geral busca={searchParams} />
      </Suspense>
    </>
  );
}

/** Painel geral para quem tem os.painel_geral; os outros vão ao do setor. */
async function Geral({ busca }: { busca: Promise<Busca> }) {
  const [b, ctx] = await Promise.all([busca, contexto()]);
  if (!ctx.pode("os.painel_geral")) {
    const [primeiro] = await setoresDoPainel();
    if (!primeiro) return <SemAcesso />;
    const qs = new URLSearchParams(
      Object.entries(b).flatMap(([k, v]) =>
        typeof v === "string" ? [[k, v]] : [],
      ),
    ).toString();
    redirect(
      `${ROTAS_OS.paineis}/${slugDoSetor(primeiro.nome)}${qs ? `?${qs}` : ""}`,
    );
  }
  return <Painel busca={b} setor={null} />;
}
