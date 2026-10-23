import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Nota } from "@/components/dashboard/tabela";
import { SelecaoEtiquetas } from "@/components/os/ativos/selecao-etiquetas";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { ROTAS_OS } from "@/lib/os/rotas";
import { ativosParaEtiqueta } from "@/server/os/ativos";
import { contexto } from "@/server/os/base";
import { GRADE, POR_FOLHA } from "@/server/os/pdf/etiquetas";

export const metadata: Metadata = { title: "Etiquetas de ativos" };

export default function Page() {
  return (
    <>
      <Link
        href={ROTAS_OS.ativos}
        className="mb-2 inline-block text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Ativos
      </Link>
      <PageHeader
        title="Etiquetas"
        description="Marque os ativos e gere o PDF para imprimir em papel adesivo. O QR abre a ficha no celular de quem já está logado, com o botão para abrir chamado."
      />
      <Suspense
        fallback={
          <TelaCarregando>
            <CartaoCarregando altura="h-24" />
            <CartaoCarregando altura="h-[32rem]" />
          </TelaCarregando>
        }
      >
        <Conteudo />
      </Suspense>
    </>
  );
}

async function Conteudo() {
  const ctx = await contexto();
  if (!ctx.pode("os.ativos_gerenciar")) return <SemAcesso />;
  const ativos = await ativosParaEtiqueta();
  return (
    <div className="flex flex-col gap-4">
      <SelecaoEtiquetas
        acao={`${ROTAS_OS.ativos}/etiquetas/pdf`}
        porFolha={POR_FOLHA}
        ativos={ativos.map((a) => ({
          id: a.id,
          codigo: a.codigo,
          nome: a.nome,
          local: a.local,
          baixado: a.situacao === "baixado",
        }))}
      />
      <Nota>
        Folha A4 com {POR_FOLHA} etiquetas ({GRADE.colunas} × {GRADE.linhas},{" "}
        {GRADE.largura} × {GRADE.altura} mm). Imprima em tamanho real (100%, sem
        ajustar à página). Para aproveitar uma folha já usada, diga em que
        etiqueta começar.
      </Nota>
    </div>
  );
}
