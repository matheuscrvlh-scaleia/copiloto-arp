import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { FormularioPublico } from "@/components/formularios/formulario-publico";
import { SemAcesso } from "@/components/protegido";
import { hexDaCor } from "@/lib/formularios/formulario";
import {
  contexto,
  formularioPorId,
  rotaDoFormulario,
} from "@/server/formularios/base";

export const metadata: Metadata = { title: "Prévia do relatório" };

// Prévia: o formulário como quem recebe o link vê, inclusive em rascunho.
// Confere as respostas como o link, mas não grava nada.

export default function Page({ params }: PageProps<"/relatorios/[id]/previa">) {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-32" />
          <CartaoCarregando altura="h-48" />
        </TelaCarregando>
      }
    >
      <Tela params={params} />
    </Suspense>
  );
}

async function Tela({
  params,
}: Pick<PageProps<"/relatorios/[id]/previa">, "params">) {
  const [{ id }, ctx] = await Promise.all([params, contexto()]);
  if (!ctx.ve) return <SemAcesso />;
  const f = await formularioPorId(id);
  if (!f) notFound();
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <Link
        href={rotaDoFormulario(f.id, ctx.edita ? "editar" : "")}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Voltar ao relatório
      </Link>
      <FormularioPublico
        titulo={f.titulo}
        descricao={f.descricao}
        campos={f.campos}
        mensagemFinal={f.mensagem_final}
        cor={hexDaCor(f.cor)}
        paginar={f.paginas}
        redirecionarPara={f.redirecionar_para}
        previa
      />
    </div>
  );
}
