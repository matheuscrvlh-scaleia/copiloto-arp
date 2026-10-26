import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { setores } from "@/server/os/base";
import { acharSetor, setoresDoPainel } from "@/server/os/paineis/acesso";
import type { Busca } from "@/server/os/paineis/consultas";
import { EsqueletoDoPainel, Painel } from "../_painel/tela";

export const metadata: Metadata = { title: "Painel do setor" };

export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ setor: string }>;
  searchParams: Promise<Busca>;
}) {
  return (
    <>
      <PageHeader
        title="Painéis"
        description="A base de todo setor (em aberto, atrasados, fechados no prazo) e os indicadores próprios dele. Todo número abre a lista que o forma."
      />
      <Suspense fallback={<EsqueletoDoPainel />}>
        <DoSetor params={params} busca={searchParams} />
      </Suspense>
    </>
  );
}

/** Painel geral vê qualquer setor; painel do setor, só os seus. */
async function DoSetor({
  params,
  busca,
}: {
  params: Promise<{ setor: string }>;
  busca: Promise<Busca>;
}) {
  const [{ setor: chave }, b, todos, liberados] = await Promise.all([
    params,
    busca,
    setores(),
    setoresDoPainel(),
  ]);
  const setor = acharSetor(todos, chave);
  if (!setor) notFound();
  if (!liberados.some((s) => s.id === setor.id)) return <SemAcesso />;
  return <Painel busca={b} setor={setor} />;
}
