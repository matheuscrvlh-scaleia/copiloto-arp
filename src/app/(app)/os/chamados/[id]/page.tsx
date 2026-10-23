import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  DetalheCarregando,
  DetalheChamado,
} from "@/components/os/chamado/detalhe";
import { Protegido } from "@/components/protegido";
import { ROTAS_OS } from "@/lib/os/rotas";

export const metadata: Metadata = { title: "Chamado" };

// Página inteira do chamado (a mesma visão da janela lateral das listas).
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <>
      <Link
        href={ROTAS_OS.caixa}
        className="mb-3 inline-flex min-h-10 items-center text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Minha caixa
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
  return <DetalheChamado id={id} />;
}
