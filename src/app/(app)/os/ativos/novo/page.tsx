import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { FormAtivo } from "@/components/os/ativos/form-ativo";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { ROTAS_OS } from "@/lib/os/rotas";
import { salvarAtivo } from "@/server/os/acoes/ativos";
import { opcoesDoCadastro } from "@/server/os/ativos";
import { contexto } from "@/server/os/base";

export const metadata: Metadata = { title: "Novo ativo" };

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
        title="Novo ativo"
        description="Só o nome é obrigatório; complete o resto quando tiver. Sem reposição, vida útil e compra, o sinal de troca não sai."
      />
      <Suspense
        fallback={
          <TelaCarregando>
            <CartaoCarregando altura="h-[48rem]" />
          </TelaCarregando>
        }
      >
        <Formulario />
      </Suspense>
    </>
  );
}

async function Formulario() {
  const ctx = await contexto();
  if (!ctx.pode("os.ativos_gerenciar")) return <SemAcesso />;
  const opcoes = await opcoesDoCadastro();
  return (
    <FormAtivo
      acao={salvarAtivo}
      verCustos={ctx.pode("os.custos")}
      {...opcoes}
    />
  );
}
