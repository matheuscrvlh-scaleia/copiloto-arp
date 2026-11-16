import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Secao } from "@/components/dashboard/tabela";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { AplicarEntrevista } from "@/components/sustentabilidade/entrevistas/aplicar";
import { rotaFicha } from "@/lib/sustentabilidade/entrevistas-chamados";
import { contextoSu } from "@/server/sustentabilidade/base";
import { dadosDeAplicar } from "@/server/sustentabilidade/entrevistas";

export const metadata: Metadata = { title: "Aplicar entrevista" };

const PROBLEMAS = {
  contrato:
    "Contrato não encontrado, ou você não tem acesso a ele. Volte à lista de entrevistas.",
  questionario:
    "O questionário ainda não foi publicado. Quem edita o questionário publica a primeira versão em Entrevistas › Editar questionário.",
  versao:
    "A versão do questionário deste rascunho não foi encontrada. Avise quem edita o questionário.",
} as const;

export default function Page({
  params,
}: PageProps<"/sustentabilidade/entrevistas/[contrato]/aplicar">) {
  return (
    <>
      <PageHeader title="Aplicar entrevista" />
      <Suspense
        fallback={
          <TelaCarregando>
            <CartaoCarregando altura="h-24" />
            <CartaoCarregando altura="h-96" />
          </TelaCarregando>
        }
      >
        <Protegido permissao="sustentabilidade.entrevistas.aplicar">
          <Tela params={params} />
        </Protegido>
      </Suspense>
    </>
  );
}

async function Tela({ params }: { params: Promise<{ contrato: string }> }) {
  const { contrato: id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [ctx, d] = await Promise.all([contextoSu(), dadosDeAplicar(id)]);
  const voltar = (
    <Link
      href={rotaFicha(id)}
      className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Ficha do contrato
    </Link>
  );
  if ("problema" in d)
    return (
      <div className="flex flex-col gap-4">
        {voltar}
        <Secao titulo="Não dá para aplicar agora">
          <p className="text-sm text-neutral-600">{PROBLEMAS[d.problema]}</p>
        </Secao>
      </div>
    );
  const s = d.rascunho;
  return (
    <div className="flex flex-col gap-4">
      {voltar}
      <AplicarEntrevista
        contratoId={d.contrato.id}
        empresa={d.contrato.cliente_nome}
        lucs={d.contrato.lucs}
        contrato={d.contrato.contrato}
        hoje={ctx.hoje}
        tipo={d.tipo}
        versao={d.versao}
        definicao={d.definicao}
        unidades={d.unidades}
        entrevistador={ctx.usuario.nome}
        servidor={
          s
            ? {
                chave: s.chave,
                versao: s.versao,
                respostas: s.respostas,
                alteradoEm: s.alteradoEm,
                respondente: s.respondente,
                urlRespondente: s.urlRespondente,
                urlEntrevistador: s.urlEntrevistador,
                temRespondente: !!s.assinaturaRespondente,
                temEntrevistador: !!s.assinaturaEntrevistador,
              }
            : null
        }
      />
    </div>
  );
}
