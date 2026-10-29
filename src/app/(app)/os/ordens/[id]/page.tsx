import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  DetalheCarregando,
  DetalheChamado,
} from "@/components/os/chamado/detalhe";
import { Protegido } from "@/components/protegido";
import { ROTAS_OS, rotaChamado } from "@/lib/os/rotas";
import { carregarDetalhe } from "@/server/os/chamado-detalhe";

export const metadata: Metadata = { title: "Ordem de serviço" };

// Página inteira da OS: o mesmo detalhe do chamado, com o bloco da OS
// (tempo, materiais, custos, terceirizado). Id de chamado vai para a
// página do chamado.
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <>
      <Link
        href={ROTAS_OS.ordens}
        className="mb-3 inline-flex min-h-10 items-center text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Ordens de serviço
      </Link>
      <Suspense fallback={<DetalheCarregando />}>
        <Protegido permissao="os.acessar">
          <Conteudo params={params} />
        </Protegido>
      </Suspense>
    </>
  );
}

async function Conteudo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await carregarDetalhe(id);
  if (d && d.ch.tipo !== "os") redirect(rotaChamado(id));
  return <DetalheChamado id={id} />;
}
