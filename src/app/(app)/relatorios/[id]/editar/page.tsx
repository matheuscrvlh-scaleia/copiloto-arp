import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { CabecalhoDoFormulario } from "@/components/formularios/cabecalho";
import { EditorDoFormulario } from "@/components/formularios/editor";
import { SemAcesso } from "@/components/protegido";
import { contexto, formularioPorId } from "@/server/formularios/base";

export const metadata: Metadata = { title: "Perguntas do relatório" };

export default function Page({ params }: PageProps<"/relatorios/[id]/editar">) {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-28" />
          <CartaoCarregando altura="h-40" />
          <CartaoCarregando altura="h-56" />
        </TelaCarregando>
      }
    >
      <Tela params={params} />
    </Suspense>
  );
}

async function Tela({
  params,
}: Pick<PageProps<"/relatorios/[id]/editar">, "params">) {
  const [{ id }, ctx] = await Promise.all([params, contexto()]);
  if (!ctx.edita) return <SemAcesso />;
  const f = await formularioPorId(id);
  if (!f) notFound();
  return (
    <>
      <CabecalhoDoFormulario f={f} aba="perguntas" edita />
      <EditorDoFormulario
        // Depois de salvar, o refresh() traz o formulário novo: o editor
        // recomeça dele (a chave muda com a data de atualização).
        key={f.atualizado_em}
        id={f.id}
        inicial={{ titulo: f.titulo, descricao: f.descricao, campos: f.campos }}
        respostas={f.total_respostas}
      />
    </>
  );
}
